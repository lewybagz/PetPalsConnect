const firebase = require("../config/firebase");
const User = require("../models/User");

/**
 * Turning a Firebase ID token into the caller, in one place.
 *
 * `middleware/authenticate` and the socket handshake both need to answer the
 * same question - who is this, and are they still allowed in - and they were
 * answering it differently: the HTTP side verified a token, and the realtime
 * side did not ask at all. `Server.js` took the user id straight off a `join`
 * event, so any connection could join any room and receive that person's
 * messages, notifications, friend requests and matches as they happened. Every
 * REST read in this codebase is scoped to `req.userId`; the socket handed the
 * same data out for free.
 *
 * Two checks live here that signature verification alone does not cover.
 */

/**
 * How long a revocation check is trusted before it is made again.
 *
 * Verifying a token's signature is offline and cryptographic - it proves the
 * token was minted by Firebase and has not expired, and it says nothing about
 * what has happened to the account since. Asking Firebase whether the account
 * has been disabled or its tokens revoked costs a round trip, so doing it on
 * every request would put a network hop in front of the whole API.
 *
 * Once every five minutes per account is the compromise: a disabled account
 * keeps working for at most that long, instead of the remaining hour of its
 * token's life, and the common path stays offline.
 */
const REVOCATION_TTL_MS = 5 * 60 * 1000;

/** uid -> timestamp of the last successful revocation check. */
const lastChecked = new Map();

/**
 * Bounded so a stream of one-off accounts cannot grow this without limit -
 * a cache with no eviction is a memory leak with a scheduler.
 */
const MAX_TRACKED = 10_000;

const dueForRevocationCheck = (uid, now) => {
  const at = lastChecked.get(uid);
  return at === undefined || now - at > REVOCATION_TTL_MS;
};

const recordRevocationCheck = (uid, now) => {
  if (lastChecked.size >= MAX_TRACKED) lastChecked.clear();
  lastChecked.set(uid, now);
};

/** Test seam: forget every cached revocation check. */
const resetRevocationCache = () => lastChecked.clear();

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Resolves a bearer token to `{ firebaseUser, user }`.
 *
 * Throws an `AuthError` the callers turn into a 401/403 or a socket rejection.
 * A missing Mongo profile is *not* an error: an account that has signed up with
 * Firebase but not yet created its profile has to be able to reach
 * `POST /api/users`, which is the call that creates one.
 */
const resolveCaller = async (token) => {
  if (!token) {
    throw new AuthError(401, "NO_TOKEN", "Missing or malformed Authorization header");
  }
  if (!firebase.isEnabled()) {
    throw new AuthError(
      503,
      "AUTH_UNAVAILABLE",
      "Authentication is not configured on this server"
    );
  }

  const now = Date.now();
  let decoded;

  try {
    // The first verification of a token is also its revocation check, so a
    // token minted after a `revokeRefreshTokens` cannot slip in during the
    // window an earlier token opened.
    decoded = await firebase.verifyIdToken(token, { checkRevoked: false });

    if (dueForRevocationCheck(decoded.uid, now)) {
      decoded = await firebase.verifyIdToken(token, { checkRevoked: true });
      recordRevocationCheck(decoded.uid, now);
    }
  } catch (error) {
    // Firebase distinguishes these, and the difference matters to a client:
    // a revoked or disabled account should stop retrying, an expired token
    // should refresh and try again.
    const revoked =
      error.code === "auth/id-token-revoked" || error.code === "auth/user-disabled";

    throw new AuthError(
      401,
      revoked ? "SESSION_REVOKED" : "INVALID_TOKEN",
      revoked ? "This session is no longer valid" : "Invalid or expired token"
    );
  }

  const user = await User.findOne({ firebaseUid: decoded.uid });

  // Reported, not thrown. Suspension used to be a filter and nothing more: a
  // suspended account disappeared from discovery, the map and search, and could
  // still open a chat, send messages and file friend requests. Three people
  // reporting a harasser hid them from strangers while leaving them pointed at
  // everyone they had already reached - the wrong half of the problem to solve.
  //
  // It is reported rather than refused here because the two callers differ:
  // the socket has nothing a suspended account may legitimately do, while HTTP
  // still has to serve the handful of routes below.
  return { firebaseUser: decoded, user, suspended: Boolean(user?.suspended) };
};

/**
 * What a suspended account may still do over HTTP.
 *
 * Reading your own profile, so the app can render rather than sit on a spinner,
 * and deleting your account - Apple requires in-app deletion of any account the
 * app let you create, and "you are suspended" is not an exemption. Everything
 * else, including every route that reaches another person, is refused.
 */
const SUSPENDED_ALLOWED = [
  { method: "GET", path: "/api/users/me" },
  { method: "DELETE", path: "/api/users/me" },
  // Appealing. Three distinct reporters hide an account automatically, and a
  // coordinated three can do it to somebody who did nothing - so a suspension
  // with no way to answer it is a permanent silent ban handed out by strangers.
  // This is the one route that reaches the operator rather than another user,
  // and it is rate limited like every other way of reaching them.
  { method: "POST", path: "/api/supportmessages" },
];

/**
 * Express gives a router mounted at `/api/supportmessages` a `path` of `/` for
 * its root route, so `baseUrl + path` is `/api/supportmessages/` - which does
 * not match the entry above, and quietly refused the one route this list
 * exists to keep open. Both sides are normalised rather than the list being
 * written with a trailing slash on some entries and not others.
 */
const normalisePath = (path) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

const allowedWhileSuspended = (method, path) => {
  const wanted = normalisePath(path);
  return SUSPENDED_ALLOWED.some(
    (allowed) => allowed.method === method && normalisePath(allowed.path) === wanted
  );
};

module.exports = {
  resolveCaller,
  allowedWhileSuspended,
  SUSPENDED_ALLOWED,
  AuthError,
  resetRevocationCache,
  REVOCATION_TTL_MS,
};

const {
  resolveCaller,
  allowedWhileSuspended,
} = require("../services/callerIdentity");

/**
 * Verifies the Firebase ID token in the Authorization header and attaches the
 * caller to the request.
 *
 * Sets:
 *   req.firebaseUser - the decoded Firebase token
 *   req.user         - the matching Mongo User document (may be null pre-signup)
 *   req.userId       - the Mongo _id, which is what controllers persist
 *
 * Controllers previously assumed req.user was a Mongo document while this
 * middleware set it to a Firebase token, so IDs never lined up. Resolving the
 * Mongo user here fixes that mismatch in one place.
 *
 * Who the caller is now comes from `services/callerIdentity`, shared with the
 * socket handshake - the realtime side used to take a user id off a `join`
 * event and trust it.
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  try {
    const { firebaseUser, user, suspended } = await resolveCaller(
      scheme === "Bearer" ? token : null
    );

    // A suspended account keeps only what it needs to read its own profile and
    // delete itself. Everything that reaches another person is closed, which is
    // what suspension was supposed to mean and previously did not.
    if (suspended && !allowedWhileSuspended(req.method, req.baseUrl + req.path)) {
      return res
        .status(403)
        .json({ message: "This account is not available", code: "ACCOUNT_SUSPENDED" });
    }

    req.firebaseUser = firebaseUser;
    req.user = user;
    req.userId = user?._id ?? null;
    req.suspended = suspended;

    return next();
  } catch (error) {
    if (!error.status) {
      console.error("[auth] Token verification failed:", error.message);
    }
    return res
      .status(error.status ?? 401)
      .json({
        message: error.message ?? "Invalid or expired token",
        code: error.code ?? "INVALID_TOKEN",
      });
  }
};

/**
 * Use after `authenticate` on routes that need a provisioned Mongo user.
 * Keeps signup/bootstrap routes usable by a Firebase user with no profile yet.
 */
const requireProfile = (req, res, next) => {
  if (!req.user) {
    return res
      .status(404)
      .json({ message: "No user profile exists for this account yet" });
  }
  return next();
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.requireProfile = requireProfile;

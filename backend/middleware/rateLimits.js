const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

/**
 * Rate limits, per account rather than per address.
 *
 * There was one limiter: 1000 requests per IP per 15 minutes across the whole
 * API. That is a blunt instrument in both directions. It counts a household or
 * an office behind one NAT as a single client, and it is far too generous for
 * the handful of routes where the cost of abuse is not server load but harm to
 * somebody: filing reports, mailing support, sending friend requests, probing
 * for which usernames exist.
 *
 * These are keyed by `req.userId` where there is one, so a limit follows the
 * account rather than the network, and one person on a shared connection cannot
 * exhaust everybody else's allowance.
 *
 * Every ceiling here is set well above what the app does in normal use. The
 * point is to make automation expensive, not to make the app feel throttled -
 * a legitimate user should never see one of these.
 */

/**
 * Count against the account when we know it, the address otherwise.
 *
 * Pre-signup calls (creating a profile, checking a username) have no account
 * yet, so they fall back to the address - which is the right unit there anyway,
 * since the abuse is creating accounts rather than using one.
 */
const byUserOrIp = (req) =>
  // `ipKeyGenerator` rather than `req.ip`: an IPv6 subscriber is typically
  // handed a whole /64, so keying on the exact address lets one person rotate
  // through billions of them and never meet a limit. The helper narrows an
  // IPv6 address to its prefix and leaves IPv4 alone.
  req.userId ? `u:${req.userId}` : `ip:${ipKeyGenerator(req.ip)}`;

/**
 * Whether the limiters actually count.
 *
 * The suite drives hundreds of requests from one address in a few seconds -
 * signing up dozens of accounts is what half of it is *for* - so leaving these
 * armed would fail tests that are exercising the thing under test, not the
 * limit. `test/helpers/harness.js` disarms them, and `rateLimits.test.js` arms
 * them again for the handful of tests that are about the limits themselves.
 *
 * A flag rather than a `NODE_ENV` check, so the limiters stay reachable from a
 * test instead of being unreachable in the only environment that runs them.
 */
let enabled = true;
const setEnabled = (value) => {
  enabled = Boolean(value);
};

const make = ({ windowMs, limit, message, skip }) =>
  rateLimit({
    windowMs,
    limit,
    skip: (req, res) => !enabled || (skip ? skip(req, res) : false),
    keyGenerator: byUserOrIp,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // The client cannot do anything useful with a JSON body it did not ask
    // for, but the shape matches every other error the API returns.
    handler: (req, res) =>
      res.status(429).json({ message, code: "RATE_LIMITED" }),
  });

/**
 * The whole API. Raised from the old 1000/IP because it now counts per account,
 * which is a much smaller bucket - a busy session with a chat open and the deck
 * refreshing sits comfortably inside it.
 */
const general = make({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  message: "Too many requests. Give it a moment.",
});

/**
 * Username availability, which is an enumeration oracle by design: it answers
 * yes or no about one name, and the app calls it as you type. Generous enough
 * for typing, useless for walking a dictionary.
 */
const usernameChecks = make({
  windowMs: 5 * 60 * 1000,
  limit: 100,
  message: "Too many username checks. Give it a moment.",
});

/**
 * Creating accounts. Per address, because there is no account yet - this is
 * the one limit whose whole job is to stop somebody minting hundreds.
 */
const signup = make({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: "Too many accounts created from here. Try again later.",
});

/**
 * Reports and support tickets. Both fan out to a human or to an inbox, and
 * three distinct reporters auto-suspend an account - so the cost of flooding
 * these is somebody else's account, not CPU.
 */
const reporting = make({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  // Reading your own reports back costs nobody anything; filing them is the
  // part with a person on the other end.
  skip: (req) => req.method === "GET",
  message: "Too many reports from this account. Try again later.",
});

/**
 * Anything that arrives in another person's app: messages, friend requests,
 * playdate invitations. Each one is a notification and a push on somebody
 * else's phone.
 */
const outreach = make({
  windowMs: 10 * 60 * 1000,
  limit: 200,
  // Reads are the app idling on a chat screen; only what it sends counts.
  skip: (req) => req.method === "GET",
  message: "You're doing that too quickly. Give it a moment.",
});

/**
 * A tracking collar reporting in. Keyed by the device's serial, since there
 * is no account: a real device reports every few seconds at most, and a
 * ceiling well above that stops one misbehaving unit from filling the
 * position collection while leaving every other collar unaffected.
 */
const ingest = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 600,
  skip: () => !enabled,
  keyGenerator: (req) => {
    const serial = String(req.headers["x-device-serial"] ?? "").trim().toUpperCase();
    return serial ? `d:${serial}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ message: "Reporting too often.", code: "RATE_LIMITED" }),
});

/**
 * Talking to Spot. The daily quota (`services/spot/quota.js`) is the product
 * limit; this is the abuse ceiling underneath it, so a script cannot spend a
 * whole day's premium allowance in a second. Reads are the screen opening.
 */
/**
 * Reads are the screen opening and do not count - except the audio route,
 * which is a GET that pays a voice provider per character.
 */
const countsAgainstSpot = (req) => req.method !== "GET" || /\/audio\/?$/.test(req.path);

const spot = make({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  skip: (req) => !countsAgainstSpot(req),
  message: "You're doing that too quickly. Give it a moment.",
});

/**
 * Analytics batches. Buffered client-side and flushed on a timer, so a busy
 * session is a handful of calls rather than one per event - but this is a
 * write endpoint every signed-in device talks to, so it gets a ceiling of its
 * own rather than sharing the general one. Well above what the app does;
 * enough to make a script writing junk into the funnel expensive.
 */
const analytics = make({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  // Reading the funnel is a moderator opening a page; only writes count.
  skip: (req) => req.method === "GET",
  message: "You're doing that too quickly. Give it a moment.",
});

/**
 * The website's waitlist form. Keyed by address, because there is no account
 * and never will be one - this is the whole point of the endpoint.
 *
 * Tight on purpose: a person fills this in once. Anything above a handful is
 * a script filling the table, and unlike every other limit here there is no
 * legitimate caller who could ever approach it.
 */
const publicWaitlist = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skip: () => !enabled,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ message: "Too many sign-ups from here. Try again later.", code: "RATE_LIMITED" }),
});

module.exports = {
  countsAgainstSpot,
  setEnabled,
  analytics,
  general,
  usernameChecks,
  signup,
  reporting,
  outreach,
  ingest,
  spot,
  publicWaitlist,
  byUserOrIp,
};

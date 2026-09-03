const firebase = require("../config/firebase");
const User = require("../models/User");

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
 */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (!header || scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or malformed Authorization header" });
  }

  if (!firebase.isEnabled()) {
    return res
      .status(503)
      .json({ message: "Authentication is not configured on this server" });
  }

  try {
    const decoded = await firebase.verifyIdToken(token);
    req.firebaseUser = decoded;

    const user = await User.findOne({ firebaseUid: decoded.uid });
    req.user = user;
    req.userId = user?._id ?? null;

    return next();
  } catch (error) {
    console.error("[auth] Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
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

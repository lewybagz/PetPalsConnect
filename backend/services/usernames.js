/**
 * Username rules, shared by validation, availability checks and signup.
 *
 * Keeping these in one place means the availability endpoint and the create
 * path can never disagree - otherwise a name reads as available and then fails
 * on submit.
 */

const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
const ALLOWED = /^[a-zA-Z0-9_]+$/;

/**
 * Names nobody may claim.
 *
 * "me" matters most: /api/users/me is a real route, and a display surface that
 * shows "@me" invites confusion. The rest are the usual impersonation and
 * support-desk risks.
 */
const RESERVED = new Set([
  "me",
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "settings",
  "account",
  "billing",
  "security",
  "login",
  "logout",
  "signup",
  "register",
  "api",
  "system",
  "moderator",
  "mod",
  "staff",
  "team",
  "official",
  "petpals",
  "petpalsconnect",
  "null",
  "undefined",
  "anonymous",
  "deleted",
]);

/** Canonical form used for uniqueness. Display keeps the original casing. */
const normalise = (username) => String(username ?? "").trim().toLowerCase();

/**
 * Returns null when acceptable, otherwise a message safe to show a user.
 */
const validate = (username) => {
  const raw = String(username ?? "").trim();

  if (!raw) return "Please choose a username.";
  if (raw.length < MIN_LENGTH) {
    return `Usernames need at least ${MIN_LENGTH} characters.`;
  }
  if (raw.length > MAX_LENGTH) {
    return `Usernames can be at most ${MAX_LENGTH} characters.`;
  }
  if (!ALLOWED.test(raw)) {
    return "Usernames can only use letters, numbers and underscores.";
  }
  if (RESERVED.has(normalise(raw))) {
    return "That username is reserved. Please pick another.";
  }
  return null;
};

module.exports = { MIN_LENGTH, MAX_LENGTH, RESERVED, normalise, validate };

/**
 * Turns Firebase and API errors into something worth showing a person.
 *
 * Firebase's `error.message` reads like
 *   "[auth/email-already-in-use] The email address is already in use by another account."
 * which leaks an internal code into the UI and buries the one sentence that
 * matters. These map the codes we can actually hit to plain language and, where
 * possible, say what to do next.
 */

const FIREBASE_MESSAGES = {
  "auth/email-already-in-use":
    "There's already an account with that email. Try signing in instead.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/weak-password": "Please choose a longer password.",
  "auth/user-disabled": "That account has been disabled. Contact support if this is a mistake.",
  "auth/user-not-found": "We couldn't find an account with those details.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/invalid-credential": "That email and password don't match.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes before trying again.",
  "auth/network-request-failed":
    "Couldn't reach the network. Check your connection and try again.",
  "auth/requires-recent-login":
    "For security, please sign in again before making this change.",
  "auth/operation-not-allowed":
    "That sign-in method isn't enabled. Please try another.",
  "auth/account-exists-with-different-credential":
    "You've already signed up with a different method. Try that one instead.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/invalid-verification-code": "That code isn't right. Please check and try again.",
  "auth/invalid-phone-number": "That doesn't look like a valid phone number.",
  "auth/missing-phone-number": "Please enter a phone number.",
  "auth/quota-exceeded": "We're a bit busy right now. Please try again shortly.",
};

const GENERIC = "Something went wrong. Please try again.";

/** A readable message for a Firebase Auth error. */
export const describeAuthError = (error) => {
  if (!error) return GENERIC;

  const mapped = FIREBASE_MESSAGES[error.code];
  if (mapped) return mapped;

  // Strip a leading "[auth/...]" so an unmapped code at least reads cleanly.
  const stripped = String(error.message ?? "").replace(/^\[[^\]]+\]\s*/, "").trim();
  return stripped || GENERIC;
};

/** A readable message for an axios error from our own API. */
export const describeApiError = (error) => {
  const status = error?.response?.status;
  const body = error?.response?.data;

  // The API returns a user-facing `message` on 400/404/409 by design.
  if (body?.message && status && status < 500) return body.message;

  if (status >= 500) return "Our server had a problem. Please try again in a moment.";
  if (error?.code === "ECONNABORTED") return "That took too long. Please try again.";
  if (!error?.response) return "Couldn't reach PetPals Connect. Check your connection.";

  return GENERIC;
};

export default { describeAuthError, describeApiError };

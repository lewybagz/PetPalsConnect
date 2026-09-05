// Firebase Admin initialisation.
//
// Credentials come from environment variables, never from a committed
// serviceAccountKey.json. Initialise exactly once and share the instance.
const admin = require("firebase-admin");
const env = require("./env");

let app = null;

if (env.firebase.enabled) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
  console.log(`[firebase] Admin initialised for project ${env.firebase.projectId}`);
}

const isEnabled = () => app !== null;

/**
 * Verify a Firebase ID token. Throws if Firebase is not configured.
 *
 * `checkRevoked` additionally asks Firebase whether the account has since been
 * disabled or its refresh tokens revoked. Signature verification alone is
 * offline and cryptographic, so a stolen ID token stays valid for the rest of
 * its hour however loudly the account has been shut down since. The cost is a
 * round trip, which is why `middleware/authenticate` does it on a schedule
 * rather than on every request.
 */
const verifyIdToken = (token, { checkRevoked = false } = {}) => {
  if (!app) throw new Error("Firebase Admin is not configured");
  return admin.auth().verifyIdToken(token, checkRevoked);
};

/** Send a single FCM message. Resolves to null when Firebase is not configured. */
const sendMessage = async (message) => {
  if (!app) {
    console.warn("[firebase] Push skipped - Firebase Admin is not configured");
    return null;
  }
  return admin.messaging().send(message);
};

/**
 * Permanently deletes a Firebase Auth account.
 *
 * Needed for in-app account deletion: Apple's App Store guideline 5.1.1(v)
 * requires any app that lets people create an account to let them delete it.
 * Removing only the Mongo profile would leave the login working with nothing
 * behind it.
 */
const deleteUser = async (uid) => {
  if (!app) throw new Error("Firebase Admin is not configured");
  return admin.auth().deleteUser(uid);
};

module.exports = { admin, isEnabled, verifyIdToken, sendMessage, deleteUser };

// Firebase Admin initialisation.
//
// Credentials come from environment variables, never from a committed
// serviceAccountKey.json. Initialise exactly once and share the instance.
// Imported from the modular entry points rather than the default namespace.
// firebase-admin v13 stopped exposing `admin.credential`, `admin.auth()` and
// `admin.messaging()` off the default export, so the old namespaced form threw
// "Cannot read properties of undefined (reading 'cert')" at load - and only
// when the FIREBASE_* variables were set, which is every environment that
// actually uses Firebase and none of the ones the suite runs in.
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");
const { getStorage } = require("firebase-admin/storage");
const env = require("./env");

let app = null;

if (env.firebase.enabled) {
  app = initializeApp({
    credential: cert({
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
  return getAuth(app).verifyIdToken(token, checkRevoked);
};

/** Send a single FCM message. Resolves to null when Firebase is not configured. */
const sendMessage = async (message) => {
  if (!app) {
    console.warn("[firebase] Push skipped - Firebase Admin is not configured");
    return null;
  }
  return getMessaging(app).send(message);
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
  return getAuth(app).deleteUser(uid);
};

/**
 * Deletes every file an account uploaded.
 *
 * Every Storage path starts with the uploader's Firebase uid (`pets/<uid>/`,
 * `profiles/<uid>/`, `chat/<uid>/`) - that is what lets `storage.rules` check
 * ownership, and it is also what makes deletion a prefix walk rather than a
 * hunt through every document for URLs. Account deletion has to remove the
 * data associated with the account, and photos are most of it by weight.
 */
const STORAGE_PREFIXES = ["pets", "profiles", "chat"];

const deleteUserFiles = async (uid) => {
  if (!app || !uid) return null;
  const bucket = getStorage(app).bucket(env.firebase.storageBucket);
  for (const prefix of STORAGE_PREFIXES) {
    await bucket.deleteFiles({ prefix: `${prefix}/${uid}/`, force: true });
  }
  return STORAGE_PREFIXES.length;
};

module.exports = { isEnabled, verifyIdToken, sendMessage, deleteUser, deleteUserFiles };

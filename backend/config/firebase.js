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

/** Verify a Firebase ID token. Throws if Firebase is not configured. */
const verifyIdToken = (token) => {
  if (!app) throw new Error("Firebase Admin is not configured");
  return admin.auth().verifyIdToken(token);
};

/** Send a single FCM message. Resolves to null when Firebase is not configured. */
const sendMessage = async (message) => {
  if (!app) {
    console.warn("[firebase] Push skipped - Firebase Admin is not configured");
    return null;
  }
  return admin.messaging().send(message);
};

module.exports = { admin, isEnabled, verifyIdToken, sendMessage };

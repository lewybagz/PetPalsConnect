// Central environment loading and validation.
// Fail fast at boot with a clear message rather than crashing deep in a request.
require("dotenv").config();

const REQUIRED = ["MONGODB_URI"];

// Required only when the corresponding feature is actually used.
const FEATURE_VARS = {
  firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  stripe: ["STRIPE_SECRET_KEY"],
  maps: ["GOOGLE_MAPS_API_KEY"],
};

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `\n[config] Missing required environment variable(s): ${missing.join(", ")}\n` +
      `[config] Copy backend/.env.example to backend/.env and fill it in.\n`
  );
  process.exit(1);
}

const has = (feature) => FEATURE_VARS[feature].every((key) => !!process.env[key]);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT) || 4000,

  mongoUri: process.env.MONGODB_URI,

  // Empty array means "allow all origins" (development default).
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  firebase: {
    enabled: has("firebase"),
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Private keys are stored with literal \n escapes in .env; restore real newlines.
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },

  stripe: {
    enabled: has("stripe"),
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,

  mail: {
    user: process.env.GMAIL_EMAIL,
    password: process.env.GMAIL_APP_PASSWORD,
  },
};

if (!env.firebase.enabled) {
  console.warn(
    "[config] Firebase Admin is not configured. Authenticated routes will reject all requests " +
      "and push notifications are disabled. Set FIREBASE_* in backend/.env to enable."
  );
}

module.exports = env;

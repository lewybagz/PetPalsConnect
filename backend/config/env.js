// Central environment loading and validation.
// Fail fast at boot with a clear message rather than crashing deep in a request.
require("dotenv").config();

const REQUIRED = ["MONGODB_URI"];

// Required only when the corresponding feature is actually used.
const FEATURE_VARS = {
  firebase: ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
  maps: ["GOOGLE_MAPS_API_KEY"],
};

// dotenv reads the file as UTF-8. PowerShell's `>` and pre-6 `Set-Content`
// write UTF-16, which parses to nothing at all - so a .env that visibly holds
// every setting reports every setting missing, with nothing saying why.
const encodingHint = () => {
  const envFile = require("node:path").resolve(process.cwd(), ".env");
  let head;
  try {
    head = require("node:fs").readFileSync(envFile).subarray(0, 2);
  } catch {
    return "";
  }
  const utf16 =
    (head[0] === 0xff && head[1] === 0xfe) ||
    (head[0] === 0xfe && head[1] === 0xff) ||
    (head[1] === 0x00 && head[0] !== 0x00);
  return utf16
    ? `[config] ${envFile} is UTF-16, which dotenv cannot read. Re-save it as UTF-8.\n`
    : "";
};

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `\n[config] Missing required environment variable(s): ${missing.join(", ")}\n` +
      encodingHint() +
      `[config] Copy backend/.env.example to backend/.env and fill it in.\n`
  );
  process.exit(1);
}

const has = (feature) => FEATURE_VARS[feature].every((key) => !!process.env[key]);

/**
 * The pet-insurance comparison link, if there is a partner.
 *
 * Both or neither. The care hub's rule is that a paid link says so on screen
 * next to the link, and it cannot say "opens X" without knowing X - so a URL
 * with no partner name is refused at boot rather than shipped undisclosed.
 * Neither set means the hub simply has no insurance card, which is the state
 * until there is a partner.
 */
const insuranceUrl = process.env.INSURANCE_COMPARE_URL || "";
const insurancePartner = process.env.INSURANCE_PARTNER_NAME || "";
if (Boolean(insuranceUrl) !== Boolean(insurancePartner)) {
  console.error(
    "\n[config] INSURANCE_COMPARE_URL and INSURANCE_PARTNER_NAME must be set together: " +
      "an affiliate link with no named partner cannot be disclosed on screen.\n"
  );
  process.exit(1);
}
if (insuranceUrl && !/^https:\/\//.test(insuranceUrl)) {
  console.error("\n[config] INSURANCE_COMPARE_URL must be an https:// URL.\n");
  process.exit(1);
}

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
    // The bucket the app uploads to. New projects get `<project>.firebasestorage.app`;
    // older ones `<project>.appspot.com` - set it explicitly if the default is wrong.
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      (process.env.FIREBASE_PROJECT_ID
        ? `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
        : undefined),
  },

  revenuecat: {
    // The exact value configured as the webhook's Authorization header in the
    // RevenueCat dashboard. Empty means the webhook route answers 503.
    webhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET || "",
  },

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,

  insurance: {
    enabled: Boolean(insuranceUrl),
    url: insuranceUrl,
    partner: insurancePartner,
  },

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

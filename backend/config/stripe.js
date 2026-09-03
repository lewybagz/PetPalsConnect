const Stripe = require("stripe");
const env = require("./env");

// Instantiating Stripe at module load with an undefined key throws and takes the
// whole server down. Build it lazily so an unconfigured Stripe only fails the
// payment routes that actually need it.
let client = null;

const getStripe = () => {
  if (!env.stripe.enabled) {
    const error = new Error("Stripe is not configured on this server");
    error.status = 503;
    throw error;
  }
  if (!client) client = new Stripe(env.stripe.secretKey);
  return client;
};

const isEnabled = () => env.stripe.enabled;

module.exports = { getStripe, isEnabled, webhookSecret: env.stripe.webhookSecret };

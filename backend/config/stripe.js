const Stripe = require("stripe");
const env = require("./env");

/**
 * The Stripe client, or null when the shop is not configured.
 *
 * Stripe was removed from this repo when subscriptions moved to RevenueCat,
 * and it is back for exactly one thing: goods that ship. Apple 3.1.3(e) and
 * Play's physical-goods rule require a normal payment processor for those, the
 * same policies that require IAP for the subscription. The two never overlap:
 * RevenueCat sells entitlements, Stripe sells objects, and nothing here ever
 * sets `user.subscribed`.
 *
 * Null rather than a throwing stub so every caller has to decide what "no
 * shop" means - the catalogue lists with nothing purchasable, checkout answers
 * 503, the webhook answers 503 - and none of them can take the app down.
 */
let client = env.stripe.enabled ? new Stripe(env.stripe.secretKey) : null;

const getStripe = () => client;

/**
 * Test seam. The suite replaces the network half with a stub and keeps the
 * real `webhooks` helpers, which are offline.
 */
const setClient = (replacement) => {
  client = replacement;
};

module.exports = { getStripe, setClient };

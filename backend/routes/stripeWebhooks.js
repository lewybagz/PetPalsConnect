const express = require("express");
const router = express.Router();

const env = require("../config/env");
const { getStripe } = require("../config/stripe");
const { syncFromEvent } = require("../services/store/stripeOrders");

/**
 * Stripe webhooks.
 *
 * Mounted at /api/stripe-webhooks, and - unlike the RevenueCat webhook - it
 * has to be mounted *above* `express.json()` and `sanitize` in Server.js, not
 * merely outside `authenticate`. `constructEvent` verifies a signature over the
 * raw request bytes; a body that has been parsed and re-serialised, or had its
 * `$`-prefixed keys stripped, never verifies and every delivery is a 400 with
 * nothing saying why. `express.raw` here is what keeps the bytes intact.
 *
 * Every acknowledged event is a 200, including types we do not act on: Stripe
 * retries anything else for days.
 */
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) {
    return res.status(503).json({ message: "The shop is not configured" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.stripe.webhookSecret
    );
  } catch (error) {
    return res.status(400).json({ message: `Webhook signature failed: ${error.message}` });
  }

  try {
    await syncFromEvent(event, stripe);
    res.json({ received: true });
  } catch (error) {
    console.error("[stripe] Handler failed:", error.message);
    res.status(500).json({ message: "Webhook handler failed" });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();

const { getStripe, isEnabled, webhookSecret } = require("../config/stripe");
const SubscriptionController = require("../controllers/SubscriptionController");

/**
 * Stripe webhooks.
 *
 * Mounted at /api/stripe-webhooks, outside `authenticate` and before the JSON
 * parser - Stripe calls this directly and the signature is checked against the
 * raw body, which a JSON parse would destroy.
 *
 * The previous version read STRIPE_ENDPOINT_SECRET while the config defines
 * STRIPE_WEBHOOK_SECRET, used Mongoose's callback API (removed in v7), and
 * queried a `userId` field the schema does not have.
 */
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  if (!isEnabled() || !webhookSecret) {
    return res.status(503).send("Stripe is not configured");
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    // A bad signature means this did not come from Stripe.
    console.warn("[stripe] Rejected webhook:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await SubscriptionController.syncFromStripe(event.data.object);
        break;

      case "invoice.paid":
      case "invoice.payment_failed": {
        const subscriptionId = event.data.object.subscription;
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await SubscriptionController.syncFromStripe(subscription);
        }
        break;
      }

      default:
        // Acknowledged but not acted on; Stripe retries anything we 500 on.
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[stripe] Handler failed:", error.message);
    res.status(500).send("Webhook handler failed");
  }
});

module.exports = router;

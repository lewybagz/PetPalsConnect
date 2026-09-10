const crypto = require("node:crypto");
const express = require("express");
const router = express.Router();

const env = require("../config/env");
const { syncFromEvent } = require("../services/subscriptions/revenuecat");

/**
 * RevenueCat webhooks.
 *
 * Mounted at /api/revenuecat-webhooks, outside `authenticate`: RevenueCat is
 * the caller, and it authenticates with the value configured as the webhook's
 * Authorization header in its dashboard, which has to equal
 * REVENUECAT_WEBHOOK_SECRET exactly. Compared in constant time, since a
 * string compare that returns on the first wrong byte leaks how much of the
 * secret was right.
 *
 * Every acknowledged event is a 200, including ones we do not act on:
 * RevenueCat retries anything else for days, and a TEST event from the
 * dashboard's "send test" button should not queue up behind a 500.
 */
const authorised = (header) => {
  const expected = env.revenuecat.webhookSecret;
  if (!expected || typeof header !== "string") return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

router.post("/", async (req, res) => {
  if (!env.revenuecat.webhookSecret) {
    return res.status(503).json({ message: "RevenueCat is not configured" });
  }
  if (!authorised(req.headers.authorization)) {
    return res.status(401).json({ message: "Unauthorised" });
  }

  const event = req.body?.event;
  if (!event || typeof event.type !== "string") {
    return res.status(400).json({ message: "No event in body" });
  }

  try {
    await syncFromEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error("[revenuecat] Handler failed:", error.message);
    res.status(500).json({ message: "Webhook handler failed" });
  }
});

module.exports = router;

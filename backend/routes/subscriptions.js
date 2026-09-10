const express = require("express");
const router = express.Router();
const SubscriptionController = require("../controllers/SubscriptionController");

// Mounted at /api/subscriptions. Read-only: buying, cancelling and resuming
// happen in the store, and RevenueCat reports the result to
// /api/revenuecat-webhooks, which is the only writer.
router.get("/me", SubscriptionController.getCurrentSubscription);
router.get("/history", SubscriptionController.getSubscriptionHistory);

module.exports = router;

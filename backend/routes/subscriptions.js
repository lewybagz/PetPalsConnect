const express = require("express");
const router = express.Router();
const SubscriptionController = require("../controllers/SubscriptionController");

router.post(
  "/create-checkout-session",
  SubscriptionController.createCheckoutSession
);
router.post("/renew", SubscriptionController.renewSubscription);
router.post("/change-plan", SubscriptionController.changeSubscriptionPlan);
router.post("/cancel", SubscriptionController.cancelSubscription);

// GET all Subscriptions
router.get("/", SubscriptionController.getAllSubscriptions);

// GET a single Subscription by ID
router.get("/:id", SubscriptionController.getSubscriptionById);

// Route to get plan details by ID
router.get("/plans/:planId", SubscriptionController.getPlanDetails);

// POST a new Subscription
router.post("/", SubscriptionController.createSubscription);
module.exports = router;

// STRIPE_SECRET_KEY=your_stripe_secret_key
// SUCCESS_URL=your_success_url
// CANCEL_URL=your_cancel_url

const express = require("express");
const router = express.Router();
const SubscriptionController = require("../controllers/SubscriptionController");
const { requireProfile } = require("../middleware/authenticate");

// Mounted at /api/subscriptions. Static paths before parameterised ones.
router.get("/plans", SubscriptionController.getPlans);
router.get("/me", SubscriptionController.getCurrentSubscription);
router.get("/history", SubscriptionController.getSubscriptionHistory);

router.post("/", requireProfile, SubscriptionController.createSubscription);
router.post("/cancel", requireProfile, SubscriptionController.cancelSubscription);
router.post("/resume", requireProfile, SubscriptionController.resumeSubscription);

module.exports = router;

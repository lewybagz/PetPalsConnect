const express = require("express");
const router = express.Router();
const SubscriptionController = require("../controllers/SubscriptionController");

// Mounted at /api/subscription-history.
router.get("/", SubscriptionController.getSubscriptionHistory);

module.exports = router;

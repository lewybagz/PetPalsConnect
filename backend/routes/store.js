const express = require("express");
const router = express.Router();
const StoreController = require("../controllers/StoreController");
const { requireModerator } = require("../services/moderation");

// Mounted at /api/store, behind `authenticate`. Buying happens on Stripe's
// hosted Checkout page; `POST /checkout` only opens one. Orders are written by
// /api/stripe-webhooks and read back here.
router.get("/products", StoreController.getProducts);
router.post("/checkout", StoreController.createCheckout);

router.get("/orders", StoreController.getOrders);
// Static segment before "/:id" - Express matches in registration order.
router.get("/orders/by-session/:sessionId", StoreController.getOrderBySession);
router.get("/orders/:id", StoreController.getOrderById);
router.post("/orders/:id/fulfilled", requireModerator, StoreController.fulfilOrder);

module.exports = router;

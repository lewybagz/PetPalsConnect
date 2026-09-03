const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/PaymentController");

// Mounted at /api/payments. These paths previously repeated the "/payments"
// prefix, so they resolved to /api/payments/payments/... and were unreachable.
router.get("/payment-methods", PaymentController.fetchPaymentMethods);
router.post("/payment-methods", PaymentController.addPaymentMethod);
router.delete(
  "/payment-methods/:paymentMethodId",
  PaymentController.deletePaymentMethod
);

module.exports = router;

const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/PaymentController"); // Adjust as per your file structure

router.post("/payment-methods", PaymentController.addPaymentMethod);

router.get("/payments/payment-methods", PaymentController.fetchPaymentMethods);

router.delete(
  "/payments/payment-methods/:paymentMethodId",
  PaymentController.deletePaymentMethod
);

module.exports = router;

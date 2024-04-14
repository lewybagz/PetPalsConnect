// In your payment methods controller

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User"); // Adjust the path as necessary

const PaymentController = {
  async fetchPaymentMethods(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findById(userId);

      if (!user || !user.stripeCustomerId) {
        return res
          .status(404)
          .json({ message: "User or Stripe customer not found" });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });

      res.json(paymentMethods.data);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  },

  async deletePaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.params;
      await stripe.paymentMethods.detach(paymentMethodId);

      res.json({ message: "Payment method deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ message: "Failed to delete payment method" });
    }
  },

  async addPaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.body; // The ID received from Stripe Elements
      const userId = req.userId;

      // Retrieve or create a Stripe customer
      const user = await User.findById(userId);
      let stripeCustomerId = user.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          /* ... */
        });
        stripeCustomerId = customer.id;
        // Update your user model with the new Stripe customer ID
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
      }

      // Attach the payment method to the Stripe customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set it as the default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      res.status(200).json({ message: "Payment method added successfully" });
    } catch (error) {
      console.error("Error adding payment method:", error);
      res.status(500).json({ message: "Failed to add payment method" });
    }
  },
};

module.exports = PaymentController;

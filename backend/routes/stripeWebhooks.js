// stripeWebhooks.js
const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;
const Subscription = require("../models/Subscription"); // Adjust path as needed
const User = require("../models/User"); // Adjust path as needed

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Extract the object from the event.
    const eventData = event.data.object;

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const customerId = eventData.customer;
      const subscriptionId = eventData.subscription;

      // Retrieve the user from your database
      User.findOne({ stripeCustomerId: customerId }, async (err, user) => {
        if (err) {
          console.error("Error finding user:", err);
          return response
            .status(500)
            .send(`Internal Server Error: ${err.message}`);
        }

        if (!user) {
          console.error("User not found!");
          return response.status(404).send("User not found.");
        }

        // Assuming you have a method to update user's subscription details
        try {
          const subscription = await Subscription.findOneAndUpdate(
            { userId: user._id },
            {
              stripeSubscriptionId: subscriptionId,
              status: "active", // or other appropriate status
            },
            { new: true, upsert: true } // upsert option creates the document if it doesn't exist
          );

          if (!subscription) {
            console.error("Subscription not found or failed to update!");
            return response
              .status(404)
              .send("Subscription not found or failed to update.");
          }

          // Send a response to acknowledge receipt of the event
          response.json({ received: true });
        } catch (updateError) {
          console.error("Failed to update subscription:", updateError);
          response
            .status(500)
            .send(`Internal Server Error: ${updateError.message}`);
        }
      });
    } else {
      console.log(`Unhandled event type ${event.type}`);
      response.json({ received: true });
    }
  }
);

module.exports = router;

const Subscription = require("../models/Subscription");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const SubscriptionController = {
  async getAllSubscriptions(req, res) {
    try {
      const subscriptions = await Subscription.find()
        .populate("User")
        .populate("Creator");
      res.json(subscriptions);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getSubscriptionById(req, res, next) {
    let subscription;
    try {
      subscription = await Subscription.findById(req.params.id)
        .populate("User")
        .populate("Creator");
      if (subscription == null) {
        return res.status(404).json({ message: "Cannot find subscription" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.subscription = subscription;
    next();
  },

  async getPlanDetails(planId) {
    try {
      const planDetails = await Subscription.findById(planId).exec();
      return planDetails; // This should return the plan details object
    } catch (error) {
      throw new Error("Error fetching plan details: " + error.message);
    }
  },

  async createStripeCheckoutSession(planId, planDetails) {
    // Create a checkout session with Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: planDetails.name,
              // Add other product details
            },
            unit_amount: planDetails.price * 100, // Assuming price is in dollars
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      // Add other necessary session details
      success_url: "your_success_url",
      cancel_url: "your_cancel_url",
    });

    return session;
  },
  async createCheckoutSession(req, res) {
    const { planId } = req.body;
    try {
      const planDetails = await this.getPlanDetails(planId);
      if (!planDetails) {
        return res.status(404).json({ error: "Plan not found" });
      }

      // Corrected call to createStripeCheckoutSession
      const session = await this.createStripeCheckoutSession(
        planId,
        planDetails
      );
      res.json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async renewSubscription(req, res) {
    try {
      const { subscriptionId } = req.body; // ID of the subscription to renew
      // Find the subscription in your database
      const subscription = await Subscription.findById(subscriptionId);

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      // Implement Stripe logic to renew the subscription
      // This might involve resetting the billing cycle, or creating a new subscription
      // depending on how your Stripe and business logic is set up

      res.status(200).json({ message: "Subscription renewed successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async changeSubscriptionPlan(req, res) {
    try {
      const { subscriptionId, newPlanId } = req.body;
      const subscription = await Subscription.findById(subscriptionId);

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      // Update the subscription's plan on Stripe
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        { items: [{ plan: newPlanId }] }
      );

      // Update the subscription in your database if needed

      res.status(200).json({ updatedSubscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async cancelSubscription(req, res) {
    try {
      const userId = req.user.id; // Make sure this is set correctly
      const subscription = await Subscription.findOne({ User: userId });

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const canceledSubscription = await stripe.subscriptions.del(
        subscription.stripeSubscriptionId
      );

      // Update subscription status in your database
      subscription.Status = "canceled"; // Example status update
      await subscription.save();

      res.status(200).json({ canceledSubscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createSubscription(req, res) {
    const subscription = new Subscription({
      EndDate: req.body.EndDate,
      PlanType: req.body.PlanType,
      StartDate: req.body.StartDate,
      Status: req.body.Status,
      SubscriptionLife: req.body.SubscriptionLife,
      User: req.body.User,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newSubscription = await subscription.save();
      res.status(201).json(newSubscription);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async checkSubscriptionStatus(userId) {
    try {
      const subscription = await Subscription.findOne({ User: userId }).exec();
      return (
        subscription &&
        subscription.Status === "Active" &&
        new Date(subscription.EndDate) > new Date()
      );
    } catch (err) {
      console.error("Error checking subscription status:", err);
      return false; // Default to false in case of an error
    }
  },
};

module.exports = SubscriptionController;

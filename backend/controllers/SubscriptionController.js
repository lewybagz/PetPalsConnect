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

  async renewSubscription(req, res) {
    try {
      const { userId } = req.body;
      // Logic to renew the subscription using Stripe
      // You need to retrieve the subscription from Stripe and create a new Checkout session
      const subscription = await Subscription.findOne({ User: userId }).exec();
      const session = await stripe.checkout.sessions.create({
        // ... Stripe checkout session parameters for renewing the subscription
      });
      res.status(200).json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async changeSubscriptionPlan(req, res) {
    try {
      const { userId, newPlan } = req.body;
      // Logic to change the subscription plan using Stripe
      const subscription = await Subscription.findOne({ User: userId }).exec();
      // Assuming you have a function to retrieve the priceId for the new plan
      const priceId = getPriceIdForPlan(newPlan);
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [
            {
              id: subscription.stripeItemId,
              price: priceId,
            },
          ],
        }
      );
      res.status(200).json({ updatedSubscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getPlanDetails(planId) {
    try {
      const planDetails = await SubscriptionPlan.findById(planId).exec();
      return planDetails; // This should return the plan details object
    } catch (error) {
      throw new Error("Error fetching plan details: " + error.message);
    }
  },
  async createCheckoutSession(req, res) {
    const { planId } = req.body;
    try {
      const planDetails = await this.getPlanDetails(planId);
      if (!planDetails) {
        return res.status(404).json({ error: "Plan not found" });
      }

      const session = await createStripeCheckoutSession(planId, planDetails); // Implement this function to create a Stripe session
      res.json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async renewSubscription(req, res) {
    // ... Logic for renewing subscription ...
  },

  async changeSubscriptionPlan(req, res) {
    // ... Logic for changing subscription plan ...
  },

  async cancelSubscription(req, res) {
    // ... Logic for canceling subscription ...
  },

  async cancelSubscription(req, res) {
    try {
      const { userId } = req.body;
      // Logic to cancel the subscription using Stripe
      const subscription = await Subscription.findOne({ User: userId }).exec();
      const canceledSubscription = await stripe.subscriptions.del(
        subscription.stripeSubscriptionId
      );
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

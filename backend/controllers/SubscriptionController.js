const Subscription = require("../models/Subscription");
const User = require("../models/User");
const { getStripe, isEnabled } = require("../config/stripe");
const { priceIdFor, listPlans } = require("../services/subscriptions/plans");

/**
 * Subscriptions, backed by Stripe.
 *
 * This used Stripe Checkout, which is a browser flow - a React Native app
 * cannot redirect to a hosted page and come back with a session. The mobile
 * path is PaymentSheet: create the subscription server-side with
 * `payment_behavior: "default_incomplete"`, hand the client the resulting
 * PaymentIntent's client secret, and let the SDK collect the card.
 *
 * Other things that could not have worked: `createCheckoutSession` called
 * `this.getPlanDetails` (Express takes handlers by reference, so `this` is
 * undefined), `getPlanDetails` was mounted as a route handler despite taking a
 * plan id and returning a value, and `mode` was "Subscription" where Stripe
 * expects lowercase.
 */

/** Finds or creates the Stripe customer for a user, remembering the id. */
const stripeCustomerFor = async (user) => {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    metadata: { userId: String(user._id), username: user.username },
  });

  await User.updateOne({ _id: user._id }, { stripeCustomerId: customer.id });
  return customer.id;
};

/** Mirrors a Stripe subscription onto our record. Safe to call repeatedly. */
const syncFromStripe = async (stripeSubscription, userId) => {
  const item = stripeSubscription.items?.data?.[0];

  const update = {
    status: stripeSubscription.status,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer,
    stripePriceId: item?.price?.id,
    amount: item?.price?.unit_amount != null ? item.price.unit_amount / 100 : undefined,
    currency: item?.price?.currency,
    planType: item?.price?.recurring?.interval ?? "month",
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
    startDate: stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : undefined,
    endDate: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : undefined,
    modifiedDate: new Date(),
  };

  if (userId) update.user = userId;

  const subscription = await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSubscription.id },
    { $set: update, $setOnInsert: { createdDate: new Date() } },
    { upsert: true, new: true }
  );

  // `subscribed` on the user is what the rest of the app reads.
  if (subscription.user) {
    await User.updateOne(
      { _id: subscription.user },
      { subscribed: ["active", "trialing"].includes(stripeSubscription.status) }
    );
  }

  return subscription;
};

const SubscriptionController = {
  syncFromStripe,

  /** The plans the app can offer, with availability resolved. */
  async getPlans(req, res) {
    res.json({ plans: listPlans(), paymentsEnabled: isEnabled() });
  },

  /** The caller's current subscription, if any. */
  async getCurrentSubscription(req, res) {
    try {
      const subscription = await Subscription.findOne({ user: req.userId }).sort({
        createdDate: -1,
      });
      res.json(subscription ?? null);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Starts a subscription and returns what PaymentSheet needs.
   *
   * The price comes from the server's plan table, never from the request - a
   * client-supplied amount is how you end up selling a year for a penny.
   */
  async createSubscription(req, res) {
    if (!isEnabled()) {
      return res.status(503).json({ message: "Payments are not configured" });
    }
    if (!req.user) {
      return res.status(404).json({ message: "No profile for this account yet" });
    }

    const priceId = priceIdFor(req.body.planId);
    if (!priceId) {
      return res.status(400).json({ message: "Unknown or unavailable plan" });
    }

    try {
      const stripe = getStripe();
      const customerId = await stripeCustomerFor(req.user);

      const existing = await Subscription.findOne({
        user: req.userId,
        status: { $in: ["active", "trialing"] },
      });
      if (existing) {
        return res.status(409).json({
          message: "You already have an active subscription",
          subscription: existing,
        });
      }

      const stripeSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { userId: String(req.userId) },
      });

      await syncFromStripe(stripeSubscription, req.userId);

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: "2024-06-20" }
      );

      res.status(201).json({
        subscriptionId: stripeSubscription.id,
        clientSecret:
          stripeSubscription.latest_invoice?.payment_intent?.client_secret ?? null,
        ephemeralKey: ephemeralKey.secret,
        customerId,
      });
    } catch (error) {
      console.error("[subscriptions] Create failed:", error.message);
      res.status(502).json({ message: error.message });
    }
  },

  /** Cancels at period end, so the user keeps what they paid for. */
  async cancelSubscription(req, res) {
    try {
      const subscription = await Subscription.findOne({
        user: req.userId,
        status: { $in: ["active", "trialing", "past_due"] },
      });

      if (!subscription?.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription to cancel" });
      }

      // `.del()` was removed from the Stripe SDK; cancelling at period end also
      // avoids refund questions from an immediate delete.
      const updated = await getStripe().subscriptions.update(
        subscription.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

      const synced = await syncFromStripe(updated, req.userId);
      res.json(synced);
    } catch (error) {
      console.error("[subscriptions] Cancel failed:", error.message);
      res.status(502).json({ message: error.message });
    }
  },

  /** Undoes a pending cancellation. */
  async resumeSubscription(req, res) {
    try {
      const subscription = await Subscription.findOne({
        user: req.userId,
        cancelAtPeriodEnd: true,
      });

      if (!subscription?.stripeSubscriptionId) {
        return res.status(404).json({ message: "No subscription to resume" });
      }

      const updated = await getStripe().subscriptions.update(
        subscription.stripeSubscriptionId,
        { cancel_at_period_end: false }
      );

      res.json(await syncFromStripe(updated, req.userId));
    } catch (error) {
      res.status(502).json({ message: error.message });
    }
  },

  /** The caller's past subscriptions. */
  async getSubscriptionHistory(req, res) {
    try {
      const history = await Subscription.find({ user: req.userId }).sort({
        createdDate: -1,
      });
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Whether a user currently has an entitlement.
   * Called directly by PetController, so it stays a plain function.
   */
  async checkSubscriptionStatus(userId) {
    try {
      const subscription = await Subscription.findOne({
        user: userId,
        status: { $in: ["active", "trialing"] },
      });

      if (!subscription) return false;
      // A cancelled-at-period-end subscription is still paid for until it ends.
      return !subscription.endDate || new Date(subscription.endDate) > new Date();
    } catch (error) {
      console.error("[subscriptions] Status check failed:", error.message);
      return false;
    }
  },
};

module.exports = SubscriptionController;

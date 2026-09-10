const Subscription = require("../models/Subscription");
const User = require("../models/User");

/**
 * Subscriptions, as the store reports them.
 *
 * Purchasing happens in the app against StoreKit / Play Billing through
 * RevenueCat, and RevenueCat tells this server what happened over
 * `routes/revenuecatWebhooks.js`. So there is nothing here that creates,
 * cancels or resumes anything: the store owns the subscription, its own
 * settings screen is where somebody changes it, and this server only reads
 * back what it was told.
 */
const SubscriptionController = {
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
   *
   * Reads the flag the webhook maintains rather than re-deriving it from the
   * rows, so that a transferred entitlement - which has a flag and no row
   * until its next renewal - answers the same here as everywhere else.
   * Called directly by PetController, so it stays a plain function.
   */
  async checkSubscriptionStatus(userId) {
    try {
      const user = await User.findById(userId).select("subscribed").lean();
      return Boolean(user?.subscribed);
    } catch (error) {
      console.error("[subscriptions] Status check failed:", error.message);
      return false;
    }
  },
};

module.exports = SubscriptionController;

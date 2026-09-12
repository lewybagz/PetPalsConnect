const Order = require("../models/Order");
const User = require("../models/User");
const { getStripe } = require("../config/stripe");
const { listProducts, CATEGORIES, CATEGORY_LABELS } = require("../services/store/products");
const {
  CheckoutError,
  priceCatalogue,
  createCheckoutSession,
} = require("../services/store/checkout");
const { markFulfilled } = require("../services/store/stripeOrders");

/**
 * The shop.
 *
 * Reads the catalogue, opens a Checkout Session, and reads the caller's own
 * orders back. Nothing here writes an order: `routes/stripeWebhooks.js` is the
 * only writer, because the redirect back from Checkout proves the person came
 * back and not that they paid.
 */
const StoreController = {
  /**
   * The catalogue with live prices. `configured: false` when there is no
   * Stripe key, in which case every price is null and the app shows the shop
   * as not open yet - a deployment state, not an error.
   */
  async getProducts(req, res) {
    try {
      const products = await priceCatalogue(listProducts());
      res.json({
        configured: Boolean(getStripe()),
        categories: CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
        products,
      });
    } catch (error) {
      console.error("[store] catalogue failed:", error.message);
      res.status(502).json({ message: "Could not load the shop right now." });
    }
  },

  /** `{ items: [{ sku, quantity }] }` -> `{ url }` for the app to open. */
  async createCheckout(req, res) {
    try {
      const user = await User.findById(req.userId).select("_id email").lean();
      if (!user) return res.status(404).json({ message: "Account not found" });

      const session = await createCheckoutSession({ user, items: req.body?.items });
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof CheckoutError) {
        return res.status(error.status).json({ message: error.message, code: error.code });
      }
      console.error("[store] checkout failed:", error.message);
      res.status(502).json({ message: "Could not start checkout." });
    }
  },

  /** The caller's own orders, newest first. */
  async getOrders(req, res) {
    try {
      const orders = await Order.find({ user: req.userId }).sort({ createdDate: -1 });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** One order, the caller's own. Anybody else's is a 404, not a 403. */
  async getOrderById(req, res) {
    try {
      const order = await Order.findOne({ _id: req.params.id, user: req.userId });
      if (!order) return res.status(404).json({ message: "Not found" });
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * The order for a Checkout Session the caller just came back from, or 404
   * while the webhook has not landed yet - which the app renders as
   * "confirming your order", not as an error.
   */
  async getOrderBySession(req, res) {
    try {
      const order = await Order.findOne({
        stripeSessionId: req.params.sessionId,
        user: req.userId,
      });
      if (!order) return res.status(404).json({ message: "Not found", code: "NOT_YET" });
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Marks an order shipped. Moderator-only (the route carries
   * `requireModerator`, and `GUARDED_READS` checks it does), because it is
   * the one write here that is not Stripe's and the one that pushes to a
   * buyer. A 3PL webhook replaces this when there is a 3PL.
   */
  async fulfilOrder(req, res) {
    try {
      const { carrier, trackingNumber } = req.body ?? {};
      const order = await markFulfilled(req.params.id, {
        carrier: typeof carrier === "string" ? carrier.slice(0, 60) : undefined,
        trackingNumber:
          typeof trackingNumber === "string" ? trackingNumber.slice(0, 80) : undefined,
      });
      if (!order) return res.status(404).json({ message: "Not found" });
      res.json(order);
    } catch (error) {
      res.status(error.status ?? 500).json({ message: error.message });
    }
  },
};

module.exports = StoreController;

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * An order as Stripe reports it.
 *
 * The only writer is `services/store/stripeOrders.syncFromEvent`, the same
 * rule `Subscription` follows for RevenueCat: Stripe is the one taking the
 * money, so Stripe is the source of truth and this row mirrors it. Nothing
 * else sets a status - a status we invented and one Stripe holds will drift,
 * and Stripe wins every time.
 *
 * `items` is a snapshot of what was charged, taken from the Checkout Session's
 * own line items rather than from the catalogue table. A price edit or a
 * renamed product must not rewrite what somebody already paid for.
 *
 * Retained on account deletion (`services/accountDeletion.RETAINED`): a paid
 * order is a financial and tax record. `services/retention.js` removes it
 * after seven years.
 */
const STATUSES = ["pending", "paid", "fulfilled", "refunded", "disputed", "failed"];

const OrderItemSchema = new Schema(
  {
    // The Stripe Price's lookup key, which is also the catalogue sku.
    sku: String,
    productId: String,
    name: { type: String, required: true },
    variantLabel: String,
    quantity: { type: Number, required: true, min: 1 },
    // In the currency's minor unit (cents), as Stripe reports it.
    unitAmount: Number,
    currency: String,
    // The tracking collar: the order screen offers the set-up step for it.
    requiresDeviceSetup: { type: Boolean, default: false },
  },
  { _id: false }
);

const ShippingSchema = new Schema(
  {
    name: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

const OrderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  stripeSessionId: { type: String, index: true },
  // Stable for the life of the payment and what every later event (refund,
  // dispute) names, so it is the upsert key.
  paymentIntentId: { type: String, unique: true, sparse: true },
  status: {
    type: String,
    enum: STATUSES,
    default: "pending",
    index: true,
  },
  items: { type: [OrderItemSchema], default: [] },
  // Minor units, as Stripe reports them.
  amountSubtotal: Number,
  amountTax: Number,
  amountShipping: Number,
  amountTotal: Number,
  amountRefunded: { type: Number, default: 0 },
  currency: { type: String, default: "usd" },
  // Stripe collected these; the app never asks.
  shipping: ShippingSchema,
  email: String,
  carrier: String,
  trackingNumber: String,
  fulfilledAt: Date,
  refundedAt: Date,
  // LIVE or TEST, so a test-mode purchase is visible for what it is.
  livemode: Boolean,
  lastEventId: String,
  modifiedDate: { type: Date, default: Date.now },
  createdDate: { type: Date, default: Date.now },
});

const Order = mongoose.model("Order", OrderSchema);

module.exports = Order;
module.exports.STATUSES = STATUSES;

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * A subscription as the store reports it, mirrored through RevenueCat.
 *
 * The only writer is `services/subscriptions/revenuecat.syncFromEvent`. Nothing
 * else may set a status: one we invented and one the store holds will drift
 * apart, and the store wins every time - it is the one taking the money.
 */
const SubscriptionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // RevenueCat's store name, lowercased: app_store, play_store, promotional...
  store: String,
  // The product id as configured in App Store Connect / Play Console.
  productId: String,
  // Stable across renewals and product changes on both stores, so it is the
  // upsert key: every event about one subscription lands on one row.
  originalTransactionId: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    enum: ["trialing", "active", "past_due", "paused", "canceled"],
    default: "active",
    index: true,
  },
  // "month" or "year", derived from the product id.
  planType: {
    type: String,
    required: true,
  },
  amount: Number,
  currency: {
    type: String,
    default: "usd",
  },
  // Auto-renew switched off in the store; the entitlement lasts to `endDate`.
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  startDate: Date,
  endDate: Date,
  // SANDBOX or PRODUCTION, so a sandbox purchase is visible for what it is.
  environment: String,
  lastEventId: String,
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
});

const Subscription = mongoose.model("Subscription", SubscriptionSchema);

module.exports = Subscription;

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Subscription
const SubscriptionSchema = new Schema({
  endDate: {
    type: Date,
    default: Date.now,
  },
  planType: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  // Mirrors Stripe's own subscription statuses so the two cannot disagree.
  status: {
    type: String,
    enum: [
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
    ],
    default: "incomplete",
    index: true,
  },
  amount: {
    type: Number,
  },
  currency: {
    type: String,
    default: "usd",
  },
  stripeSubscriptionId: {
    type: String,
    index: true,
  },
  stripeCustomerId: {
    type: String,
    index: true,
  },
  stripePriceId: {
    type: String,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  slug: String,
});

// Create a model
const Subscription = mongoose.model("Subscription", SubscriptionSchema);

module.exports = Subscription;

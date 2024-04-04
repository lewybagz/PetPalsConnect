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
  status: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

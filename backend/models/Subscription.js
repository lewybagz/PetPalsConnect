const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Subscription
const SubscriptionSchema = new Schema({
  EndDate: {
    type: Date,
    default: Date.now,
  },
  PlanType: {
    type: String,
    required: true,
  },
  StartDate: {
    type: Date,
    default: Date.now,
  },
  Status: {
    type: String,
    required: true,
  },
  Amount: {
    type: Number,
    required: true,
  },
  User: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ModifiedDate: {
    type: Date,
    default: Date.now,
  },
  CreatedDate: {
    type: Date,
    default: Date.now,
  },
  Slug: String,
});

// Create a model
const Subscription = mongoose.model("Subscription", SubscriptionSchema);

module.exports = Subscription;

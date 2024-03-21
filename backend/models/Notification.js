const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Notification
const NotificationSchema = new Schema({
  Content: {
    type: String,
    required: true,
  },
  ReadStatus: {
    type: Boolean,
    default: false, // false for 'no', true for 'yes'
  },
  Recipient: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Timestamp: {
    type: Date,
    default: Date.now,
  },
  Type: {
    type: String,
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
const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;

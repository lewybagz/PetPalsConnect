const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Notification
const NotificationSchema = new Schema({
  content: {
    type: String,
    required: true,
  },
  readStatus: {
    type: Boolean,
    default: false,
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
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
const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;

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
  // Contextual, not universal: "you have a new message" concerns no pet.
  // Requiring it made every notification in the app fail validation.
  petName: {
    type: String,
  },
  type: {
    type: String,
    required: true,
  },
  // Optional so the server can raise a notification nobody caused - a playdate
  // reminder from the scheduler has no creating user.
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
const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;

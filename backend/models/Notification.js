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
  /**
   * What the row's destination needs to route with - a `petId`, a `chatId`,
   * an `orderId`.
   *
   * `notify()` was already taking a `data` object and putting it only in the
   * *push*, so a notification tapped from the lock screen went to the right
   * place and the same notification tapped in the app's own list went to the
   * screen with no parameter. `notificationTypes.js` names a `param` per type
   * precisely so a tap lands somewhere; four types (`vaccinationDue`,
   * `healthDue`, `trackingShared`, `petProfileIncomplete`) had nowhere to read
   * it from.
   *
   * Mixed and small, like the analytics props: ids and nothing else. It is
   * written by `notify()` from its own callers, never from a request body.
   */
  data: {
    type: Schema.Types.Mixed,
    default: {},
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

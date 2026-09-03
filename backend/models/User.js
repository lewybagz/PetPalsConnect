const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// Create Schema for User
const UserSchema = new Schema({
  // Links this profile to the Firebase Auth account. Firebase is the single
  // source of truth for credentials; this server never stores passwords.
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fcmToken: {
    type: String,
    required: false, // This is not a required field because not all users may have an FCM token (e.g., web users)
  },
  friendsList: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  location: {
    type: Schema.Types.ObjectId,
    ref: "Location",
    required: false, // Set to false if you allow users to not share their location
  },
  playdateRange: {
    type: String,
    enum: ["All", "Within 10 miles", "Within 20 miles", "Within 50 miles"],
    default: "All",
  },
  notificationsEnabled: {
    type: Boolean,
    default: true,
  },
  // Per-category toggles shown on the app's Settings screen. `notificationsEnabled`
  // above remains the master switch.
  notificationPreferences: {
    petPalsMapUpdates: { type: Boolean, default: false },
    playdateReminders: { type: Boolean, default: false },
    appUpdates: { type: Boolean, default: false },
  },
  favorites: [
    {
      type: Schema.Types.ObjectId,
      ref: "Favorite",
    },
  ],
  locationSharingEnabled: {
    type: Boolean,
    default: true,
  },
  // `required: false` was previously listed here as if it were a field, which
  // Mongoose 9 rejects as an invalid schema type. Subdocument arrays are
  // optional by default, so it is simply removed.
  securityQuestions: [
    {
      question: String,
      answer: String,
    },
  ],

  pets: [
    {
      type: Schema.Types.ObjectId,
      ref: "Pet", // Refers to the Pet discriminator of the Content model
    },
  ],
  subscribed: {
    type: Boolean,
    default: false,
  },
  stripeCustomerId: {
    type: String,
    required: false,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  userPhoto: {
    type: String,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  // NOTE: no password field by design. Firebase Auth owns credentials, so this
  // database never sees or stores one. Do not reintroduce it.
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
const User = mongoose.model("User", UserSchema);

module.exports = User;

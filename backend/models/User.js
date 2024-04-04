const mongoose = require("mongoose");
const Schema = mongoose.Schema;
// Create Schema for User
const UserSchema = new Schema({
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
  locationSharingEnabled: {
    type: Boolean,
    default: true,
  },
  securityQuestions: [
    {
      question: String,
      answer: String,
      required: false,
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
  },
  userPhoto: {
    type: String, // URL to the user's photo
  },
  verified: {
    type: Boolean,
    default: false,
  },
  email: {
    type: String,
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
const User = mongoose.model("User", UserSchema);

module.exports = User;

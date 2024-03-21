const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { ContentSchema, PetSchema } = require("./Content");

// Create Schema for User
const UserSchema = new Schema({
  FcmToken: {
    type: String,
    required: false, // This is not a required field because not all users may have an FCM token (e.g., web users)
  },
  FriendsList: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  Location: {
    type: Schema.Types.ObjectId,
    ref: "Location",
    required: false, // Set to false if you allow users to not share their location
  },
  locationSharingEnabled: {
    type: Boolean,
    default: true,
  },
  Pets: [
    {
      type: Schema.Types.ObjectId,
      ref: "Pet", // Refers to the Pet discriminator of the Content model
    },
  ],
  Subscribed: {
    type: Boolean,
    default: false,
  },
  stripeCustomerId: {
    type: String,
    required: false, // This field is not required because you will fill it when the user subscribes
  },
  Username: {
    type: String,
    required: true,
  },
  UserPhoto: {
    type: String, // URL to the user's photo
  },
  Verified: {
    type: Boolean,
    default: false,
  },
  Email: {
    type: String,
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
const User = mongoose.model("User", UserSchema);

module.exports = User;

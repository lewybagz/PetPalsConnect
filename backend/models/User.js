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
  /**
   * How far this person will travel for a playdate, in miles.
   *
   * Was an enum of strings ("Within 10 miles"). The settings screen has a
   * slider and sent a number, which failed enum validation every time, so the
   * preference has never once saved - and nothing read it anyway. Miles is
   * also what `/api/locations/playdate-locations` already takes, so the whole
   * app now speaks one unit.
   *
   * 0 means no limit.
   */
  playdateRange: {
    type: Number,
    min: 0,
    max: 500,
    default: 25,
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
  /**
   * Where this person is, as GeoJSON [longitude, latitude].
   *
   * `location` above is a reference to a *place* - a park they saved. It has
   * never been where the user is, so matching had no idea how far apart two
   * pets were and `playdateRange` enforced nothing. A playdate is a thing you
   * travel to; distance is not a detail.
   *
   * Sparse, because sharing a position is optional and a null Point would
   * otherwise put everyone who declined at [0,0], in the Atlantic.
   */
  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
  },
  locationUpdatedAt: {
    type: Date,
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
    trim: true,
  },
  // Uniqueness is enforced here, not on `username`, so "PetLover" and
  // "petlover" cannot both exist. `username` keeps the casing the user chose.
  usernameLower: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
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

// Keeps usernameLower in step with username on every save, so no call site can
// set one without the other.
UserSchema.pre("validate", function setUsernameLower() {
  if (this.username) {
    this.usernameLower = this.username.trim().toLowerCase();
  }
});

// Create a model
const User = mongoose.model("User", UserSchema);

module.exports = User;

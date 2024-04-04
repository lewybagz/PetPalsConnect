const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for UserPreferences
const UserPreferencesSchema = new Schema({
  locationSharingEnabled: {
    type: Boolean,
    default: false,
  },
  playdateRange: {
    type: Number,
    default: 5,
  },
  notificationPreferences: {
    petPalsMapUpdates: { type: Boolean, default: true },
    playdateReminders: { type: Boolean, default: true },
    appUpdates: { type: Boolean, default: true },
    pushNotificationsEnabled: { type: Boolean, default: true },
    emailNotificationsEnabled: { type: Boolean, default: false },
  },
  darkModeEnabled: {
    type: Boolean,
    default: false,
  },
  profileVisibility: {
    type: Boolean,
    default: true,
  },
  twoFactorAuthenticationEnabled: {
    type: Boolean,
    default: false,
  },
  securityQuestions: [
    {
      question: String,
      answer: String,
    },
  ],
  user: {
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
  slug: {
    type: String,
    lowercase: true,
    unique: true,
    trim: true,
  },
});

// Create a model
const UserPreferences = mongoose.model(
  "UserPreferences",
  UserPreferencesSchema
);

module.exports = UserPreferences;

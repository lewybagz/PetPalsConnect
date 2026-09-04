const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * What somebody wants to be told about.
 *
 * This used to be a second, parallel copy of the account settings: it carried
 * `locationSharingEnabled`, `playdateRange`, `darkModeEnabled`,
 * `profileVisibility`, `twoFactorAuthenticationEnabled` and
 * `securityQuestions`, every one of which also lives on `User` - and `User` is
 * the one matching, playdates and the settings screen read. Two homes for a
 * setting is two answers to the same question, so this now holds only the one
 * thing `User` does not: which notifications to send.
 *
 * `slug` was `unique: true` and not sparse. MongoDB indexes a missing value as
 * null, so the *second* account to get a preferences row collided with the
 * first and the save failed - which nobody noticed, because nothing ever
 * created one successfully anyway.
 */
const UserPreferencesSchema = new Schema({
  notificationPreferences: {
    // The master switch. Off means no push at all; the notification is still
    // written, so the list and the badge still work.
    pushNotificationsEnabled: { type: Boolean, default: true },
    emailNotificationsEnabled: { type: Boolean, default: false },
    // Per category, for the things people most often want to keep but quieten.
    messages: { type: Boolean, default: true },
    matches: { type: Boolean, default: true },
    playdateReminders: { type: Boolean, default: true },
    friendRequests: { type: Boolean, default: true },
    appUpdates: { type: Boolean, default: true },
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
});

const UserPreferences = mongoose.model(
  "UserPreferences",
  UserPreferencesSchema
);

module.exports = UserPreferences;

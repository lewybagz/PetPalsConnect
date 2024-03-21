const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for UserPreferences
const UserPreferencesSchema = new Schema({
  NotificationSettings: {
    type: String, // This could be JSON or a specific schema if the settings are complex
    default: "",
  },
  SearchSettings: {
    type: String, // This could also be JSON or a specific schema if the settings are complex
    default: "",
  },
  User: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
const UserPreferences = mongoose.model(
  "UserPreferences",
  UserPreferencesSchema
);

module.exports = UserPreferences;

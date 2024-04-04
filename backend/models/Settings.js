const mongoose = require("mongoose");
const { Schema } = mongoose;

// Mongoose schema for Settings
const SettingsSchema = new Schema(
  {
    _id: Schema.Types.ObjectId,
    locationSharingEnabled: {
      type: Boolean,
      default: false,
    },
    playdateRange: {
      type: Number,
      default: 5,
    },
    darkMode: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      petPalsMapUpdates: { type: Boolean, default: true },
      playdateReminders: { type: Boolean, default: true },
      appUpdates: { type: Boolean, default: true },
      // Add more specific notification preferences if needed
    },
    // Include any additional properties as needed
  },
  { timestamps: true }
); // Timestamps will create `createdAt` and `updatedAt` fields

// Create a model
const Settings = mongoose.model("Settings", SettingsSchema);

module.exports = Settings;

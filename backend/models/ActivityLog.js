const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for ActivityLog
const ActivityLogSchema = new Schema({
  ActionDetails: {
    type: String,
    required: true,
  },
  ActionType: {
    type: String,
    required: true,
  },
  Timestamp: {
    type: Date,
    default: Date.now,
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
const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);

module.exports = ActivityLog;

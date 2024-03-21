const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Report
const ReportSchema = new Schema({
  Content: {
    type: String,
    required: true,
  },
  ReportedContent: {
    type: String, // This may need to be an ObjectId if it refers to a specific reported item
    required: true,
  },
  ReportedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  Reporter: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Status: {
    type: String,
    required: true,
  },
  Timestamp: {
    type: Date,
    default: Date.now,
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
const Report = mongoose.model("Report", ReportSchema);

module.exports = Report;

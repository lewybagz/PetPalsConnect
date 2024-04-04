const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Report
const ReportSchema = new Schema({
  content: {
    type: String,
    required: true,
  },
  reportedContent: {
    type: String, // This may need to be an ObjectId if it refers to a specific reported item
    required: true,
  },
  reportedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  reporter: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  creator: {
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
  slug: String,
});

// Create a model
const Report = mongoose.model("Report", ReportSchema);

module.exports = Report;

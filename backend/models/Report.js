const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const {
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGETS,
} = require("../services/reportStates");

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
  // What kind of thing `reportedContent` names, so a queue can be triaged
  // without opening every row.
  reportedContentType: {
    type: String,
    enum: REPORT_TARGETS,
    default: "user",
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
  // Free text tells you what happened; a category tells you how urgent it is.
  // "unsafe" is not "spam", and they cannot wait in the same line.
  reason: {
    type: String,
    enum: REPORT_REASONS,
    default: "other",
  },
  status: {
    type: String,
    enum: REPORT_STATUSES,
    default: "pending",
    required: true,
    index: true,
  },
  /** What was decided, in words, when the report left `pending`. */
  resolution: {
    type: String,
  },
  resolvedAt: {
    type: Date,
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
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

// One person reporting the same thing twice is one report, not two - otherwise
// the auto-suspension threshold below could be reached by a single account.
ReportSchema.index(
  { reporter: 1, reportedUser: 1, reportedContent: 1 },
  { unique: true }
);

// Create a model
const Report = mongoose.model("Report", ReportSchema);

module.exports = Report;

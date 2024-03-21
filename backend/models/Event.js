const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Event
const EventSchema = new Schema({
  Attendees: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  Date: {
    type: Date,
    required: true,
  },
  Description: {
    type: String,
    required: true,
  },
  Organizer: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Title: {
    type: String,
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
const Event = mongoose.model("Event", EventSchema);

module.exports = Event;

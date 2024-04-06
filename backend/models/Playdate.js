const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Playdate
const PlaydateSchema = new Schema({
  date: {
    type: Date,
    required: true,
  },
  location: {
    type: Schema.Types.ObjectId,
    ref: "Location",
    required: true,
  },
  notes: {
    type: String,
  },
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  petsInvolved: [
    {
      type: Schema.Types.ObjectId,
      ref: "Pet",
    },
  ],
  startTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "completed", "cancelled"],
    default: "pending",
  },
  reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
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
const Playdate = mongoose.model("Playdate", PlaydateSchema);

module.exports = Playdate;

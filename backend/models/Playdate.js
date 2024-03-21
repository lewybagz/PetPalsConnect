const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Playdate
const PlaydateSchema = new Schema({
  Date: {
    type: Date,
    required: true,
  },
  Location: {
    type: Schema.Types.ObjectId,
    ref: "Location",
    required: true,
  },
  Notes: {
    type: String,
  },
  Participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  PetsInvolved: [
    {
      type: Schema.Types.ObjectId,
      ref: "Pet", // Assuming 'Pet' is a separate schema/model we will create
    },
  ],
  startTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "completed"],
    default: "pending",
  },
  Reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
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
const Playdate = mongoose.model("Playdate", PlaydateSchema);

module.exports = Playdate;

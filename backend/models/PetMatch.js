const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for PetMatch
const PetMatchSchema = new Schema({
  MatchScore: {
    type: Number,
    required: true,
  },
  Pet1: {
    type: Schema.Types.ObjectId,
    ref: "Pet", // Assuming 'Pet' is a separate schema/model
    required: true,
  },
  Pet2: {
    type: Schema.Types.ObjectId,
    ref: "Pet", // Assuming 'Pet' is a separate schema/model
    required: true,
  },
  RelevantToUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
const PetMatch = mongoose.model("PetMatch", PetMatchSchema);

module.exports = PetMatch;

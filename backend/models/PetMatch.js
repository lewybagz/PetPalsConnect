const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for PetMatch
const PetMatchSchema = new Schema({
  matchScore: {
    type: Number,
    required: true,
  },
  pet1: {
    type: Schema.Types.ObjectId,
    ref: "Pet", // Assuming 'Pet' is a separate schema/model
    required: true,
  },
  pet2: {
    type: Schema.Types.ObjectId,
    ref: "Pet", // Assuming 'Pet' is a separate schema/model
    required: true,
  },
  relevantToUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
const PetMatch = mongoose.model("PetMatch", PetMatchSchema);

module.exports = PetMatch;

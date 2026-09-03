const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * One pet's verdict on another.
 *
 * `PetMatch` is the *score* cache - what the algorithm thinks of a pair. This
 * is what a person decided, which is a different thing and needs its own
 * record: a match nobody looked at is not the same as one somebody passed on.
 *
 * Keeping them apart also means re-running matching (which rewrites PetMatch)
 * can never resurrect a candidate the owner has already dismissed.
 */
const PetDecisionSchema = new Schema({
  fromPet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
    required: true,
    index: true,
  },
  toPet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
    required: true,
    index: true,
  },
  // Denormalised so "did anyone like my pets" is one query, not a join.
  fromUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  toUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  decision: {
    type: String,
    enum: ["like", "pass"],
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
});

// One verdict per direction per pair. Without this, a double tap writes two
// rows and the "have they liked us back" check counts the same like twice.
PetDecisionSchema.index({ fromPet: 1, toPet: 1 }, { unique: true });

module.exports = mongoose.model("PetDecision", PetDecisionSchema);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for BlockList
const BlockListSchema = new Schema({
  blockedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  blockedUserList: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

// One row per pair. Without this, tapping "Block" twice on a flaky connection
// leaves two rows and one unblock removes only one of them - the block appears
// to come back by itself. Partial, because `blockedUser` is optional on this
// schema and the legacy `blockedUserList` rows have none.
BlockListSchema.index(
  { owner: 1, blockedUser: 1 },
  { unique: true, partialFilterExpression: { blockedUser: { $exists: true } } }
);

// Read on every discovery, search and chat open, from the far side of the pair.
BlockListSchema.index({ blockedUser: 1 });

// Create a model
const BlockList = mongoose.model("BlockList", BlockListSchema);

module.exports = BlockList;

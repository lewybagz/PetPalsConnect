const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for BlockList
const BlockListSchema = new Schema({
  BlockedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  BlockedUserList: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  Owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
const BlockList = mongoose.model("BlockList", BlockListSchema);

module.exports = BlockList;

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

// Create a model
const BlockList = mongoose.model("BlockList", BlockListSchema);

module.exports = BlockList;

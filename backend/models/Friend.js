const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Friend
const FriendSchema = new Schema({
  Status: {
    type: Boolean,
    default: false, // false for 'no', true for 'yes'
  },
  Timestamp: {
    type: Date,
    default: Date.now,
  },
  User1: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  User2: {
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

const Friend = mongoose.model("Friend", FriendSchema);

module.exports = Friend;

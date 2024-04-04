const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Friend
const FriendSchema = new Schema({
  status: {
    type: Boolean,
    default: false, // false for 'no', true for 'yes'
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  user1: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  user2: {
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

const Friend = mongoose.model("Friend", FriendSchema);

module.exports = Friend;

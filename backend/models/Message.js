const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Message
const MessageSchema = new Schema({
  contentImage: {
    type: String, // Assuming this will be a URL to the image
  },
  contentText: {
    type: String,
    required: true,
  },
  readStatus: {
    type: Boolean,
    default: false, // false for 'no', true for 'yes'
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
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
});

// Create a model
const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;

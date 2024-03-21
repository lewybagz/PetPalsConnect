const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Message
const MessageSchema = new Schema({
  ContentImage: {
    type: String, // Assuming this will be a URL to the image
  },
  ContentText: {
    type: String,
    required: true,
  },
  ReadStatus: {
    type: Boolean,
    default: false, // false for 'no', true for 'yes'
  },
  Receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Sender: {
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
const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;

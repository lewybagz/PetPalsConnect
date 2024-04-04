const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for GroupChat
const GroupChatSchema = new Schema({
  groupName: {
    type: String,
    required: true,
  },
  messages: [
    {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
  ],
  media: [
    {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },
  ],
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "Pet",
    },
  ],
  isMuted: {
    type: Boolean,
    default: false,
  },
  isArchived: { type: Boolean, default: false },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
});

// Create a model
const GroupChat = mongoose.model("GroupChat", GroupChatSchema);
module.exports = GroupChat;

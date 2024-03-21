const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for GroupChat
const GroupChatSchema = new Schema({
  GroupName: {
    type: String,
    required: true,
  },
  Messages: [
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
  Participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isMuted: {
    type: Boolean,
    default: false,
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
const GroupChat = mongoose.model("GroupChat", GroupChatSchema);

module.exports = GroupChat;

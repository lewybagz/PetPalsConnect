const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chatSchema = new Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  media: [
    {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },
  ],
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  ],
  isMuted: {
    type: Boolean,
    default: false,
  },
  petId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pet",
    required: true,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  isArchived: { type: Boolean, default: false },
});

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;

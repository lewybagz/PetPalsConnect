const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for GroupChat
const GroupChatSchema = new Schema({
  // Not unique: two unrelated sets of friends can both call their group
  // "Dog park", and a global uniqueness constraint made the second one fail to
  // save. What identifies a group is who is in it.
  groupName: {
    type: String,
    required: true,
  },
  // The sorted participant set, hashed - the same idea 1:1 chats use, so
  // find-or-create returns the same group whoever asks and in whatever order.
  chatId: {
    type: String,
    unique: true,
    sparse: true,
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
  // People, not pets. Every query treats these as users - `getAllGroupChats`
  // filters `participants: req.userId` and the notification fan-out looks them
  // up in `User` - but the ref said "Pet", so `.populate("participants")`
  // resolved user ids against the pet collection and produced nulls.
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // Muting is per person. One shared `isMuted` meant muting a group for
  // yourself muted it for everybody in it.
  mutedBy: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
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

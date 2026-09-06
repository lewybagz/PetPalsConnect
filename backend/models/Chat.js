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
  // Per person, not per conversation: a shared boolean would let one side
  // silence the other's notifications.
  mutedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  /**
   * The two pets the conversation is between, and what identifies it.
   *
   * This used to be a single `petId` - whichever pet the caller happened to tap
   * to start the thread - while `chatId` was hashed from the two *owners*. So
   * one person with three dogs had one conversation with you regardless of
   * which dog either of you was talking about, and the pet recorded on it was
   * only ever the one that opened it. A conversation in this app is between two
   * animals, so it is keyed by them: `chatId` is the hash of the sorted pet
   * pair, and two of your pets talking to the same person are two threads.
   *
   * `participants` stays, and is still what every read is scoped by: blocking,
   * muting and account suspension are all properties of a person, not a dog.
   */
  pets: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pet" }],
    required: true,
    validate: {
      validator: (pets) => pets.length === 2,
      message: "A one-to-one chat is between exactly two pets",
    },
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
  isPinned: { type: Boolean, default: false },
});

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;

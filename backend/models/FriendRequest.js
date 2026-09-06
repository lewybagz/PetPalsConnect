const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FriendRequestSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  /**
   * Which pet is asking, and which is being asked.
   *
   * `sender` and `receiver` stay: the request is delivered to a person, the
   * audience check that decides whether it may be sent is a property of a
   * person, and a block is between people. These name the animals it is about,
   * so the notification can read "Sky wants to be pals with Bo" rather than
   * naming an account somebody has never heard of.
   */
  senderPet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
  },
  receiverPet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
});

const FriendRequest = mongoose.model("FriendRequest", FriendRequestSchema);
module.exports = FriendRequest;

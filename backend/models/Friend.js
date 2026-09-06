const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Friend
const FriendSchema = new Schema({
  status: {
    type: Boolean,
    default: false,
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

  /**
   * The two pets who are pals, matching `user1` and `user2` in order.
   *
   * A friendship in this app is between animals: two dogs met, got on, and
   * their owners agreed to keep in touch. The owners are still recorded and
   * still what every scoped read filters by, because blocking, suspension and
   * audience settings are all properties of a person - you do not block a dog.
   * But the row now knows which animals it is about, so the UI can say "Bo and
   * Sky are pals" instead of naming two strangers.
   *
   * Optional rather than required: friendships written before pets were
   * recorded have none, and a person whose only pet has since been deleted
   * still has the friendship.
   */
  pet1: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
  },
  pet2: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
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

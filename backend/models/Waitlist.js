const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Somebody outside the launch area who asked to be told when it opens near
 * them.
 *
 * One row per account - the route upserts on `user` - and the ZIP and region
 * are copied from the profile at the time, not taken from the body, so the
 * list says where people actually said they were. The email is on the
 * account already; nothing is typed to join.
 */
const WaitlistSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  zip: { type: String },
  region: { type: String, index: true },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdDate: { type: Date, default: Date.now },
});

const Waitlist = mongoose.model("Waitlist", WaitlistSchema);

module.exports = Waitlist;

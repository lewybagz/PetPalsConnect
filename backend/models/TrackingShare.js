const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * "Alex may see where Bo's collar is, until Thursday."
 *
 * Per pet, per friend, and always expiring. "Share my dog's live location"
 * is nearly always about right now - a walk, a sitter, a lost dog - and a
 * share with no end is one nobody remembers to revoke. `expiresAt` is
 * required and carries a TTL index, so Mongo removes the row on time even if
 * nothing reads it again; `visibility.js` also checks the date, because a TTL
 * sweep runs about once a minute and a minute is long enough to matter.
 *
 * The viewer must be a friend at the time of sharing, and a block in either
 * direction ends the share's effect immediately regardless of the date -
 * that check lives in `visibility.canView`, next to the date.
 */
const DEFAULT_HOURS = 24;
const MAX_HOURS = 7 * 24;

const TrackingShareSchema = new Schema({
  pet: { type: Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  viewer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdDate: { type: Date, default: Date.now },
});

// One share per pet per person; extending it is an update.
TrackingShareSchema.index({ pet: 1, viewer: 1 }, { unique: true });

const TrackingShare = mongoose.model("TrackingShare", TrackingShareSchema);

module.exports = TrackingShare;
module.exports.DEFAULT_HOURS = DEFAULT_HOURS;
module.exports.MAX_HOURS = MAX_HOURS;

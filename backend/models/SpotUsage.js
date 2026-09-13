const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * How many model turns an owner has spent today.
 *
 * One row per owner per day, keyed on the person's own calendar day (the
 * device sends its offset with each message, the way quiet hours already
 * do). `count` is moved with a single `$inc` upsert, so two messages sent at
 * once cannot both squeeze under the cap. Only turns that reach the model
 * are counted: the chips, the intents and an exact toxin hit are software
 * and cost nothing.
 */
const SpotUsageSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  /** "YYYY-MM-DD" in the owner's local day. */
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
});

SpotUsageSchema.index({ owner: 1, day: 1 }, { unique: true });

const SpotUsage = mongoose.model("SpotUsage", SpotUsageSchema);

module.exports = SpotUsage;

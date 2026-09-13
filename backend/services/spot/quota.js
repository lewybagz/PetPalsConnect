const SpotUsage = require("../../models/SpotUsage");

/**
 * How many model turns a person may spend in a day.
 *
 * Only turns that reach the model count. The chips, the intents and an exact
 * toxin hit are software, answered on the device, and cost nothing - so
 * somebody who only ever asks "is Bella due for anything?" never touches
 * this. A toxin question that reaches the model counts, as decided.
 *
 * Sizing. The premium price lives in the stores, not here, so the numbers are
 * placeholders derived from the formula in the plan:
 *
 *   net per subscriber per month = store price x (1 - store cut)   ~ $6.79 at $7.99
 *   model turn cost (Opus 5, low effort)                            ~ $0.04 - $0.05
 *   break-even model turns per month                                ~ 135 - 170
 *
 * A ceiling bounds one account; the average is what the bill is. Free is a
 * bounded loss leader; premium sits under net revenue at realistic use and
 * the ceiling exists for abuse, not for people. The runner logs usage per
 * turn so the real average replaces the guess after the first month. If it
 * runs hot, `SPOT_MODEL=claude-sonnet-5` is the first lever and lowering
 * these is the second.
 */
const FREE_PER_DAY = 3;
const PREMIUM_PER_DAY = 25;

/** The largest offset a real clock can have, either side of UTC. */
const MAX_OFFSET_MINUTES = 14 * 60;

/**
 * "YYYY-MM-DD" in the person's own day. The device sends its offset with
 * each message the way quiet hours already do; the phone doing the asking is
 * the one that knows where its owner is.
 */
const dayFor = (now = new Date(), utcOffsetMinutes = 0) => {
  const offset = Number.isFinite(Number(utcOffsetMinutes))
    ? Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, Number(utcOffsetMinutes)))
    : 0;
  return new Date(now.getTime() + offset * 60 * 1000).toISOString().slice(0, 10);
};

const limitFor = (subscribed) => (subscribed ? PREMIUM_PER_DAY : FREE_PER_DAY);

/**
 * Spends one turn, or refuses.
 *
 * One `$inc` upsert, then a check: two messages sent at once both increment
 * and the second one sees a count over the limit, so a race cannot squeeze
 * two turns under a cap of one. A refused spend is put back.
 */
const spend = async ({ userId, day, limit }) => {
  const row = await SpotUsage.findOneAndUpdate(
    { owner: userId, day },
    { $inc: { count: 1 }, $setOnInsert: { owner: userId, day } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  if (row.count > limit) {
    await SpotUsage.updateOne({ _id: row._id }, { $inc: { count: -1 } });
    return { allowed: false, used: row.count - 1, limit };
  }
  return { allowed: true, used: row.count, limit };
};

/** A turn that never reached the model is given back. */
const refund = async ({ userId, day }) => {
  await SpotUsage.updateOne({ owner: userId, day, count: { $gt: 0 } }, { $inc: { count: -1 } });
};

const usedToday = async ({ userId, day }) => {
  const row = await SpotUsage.findOne({ owner: userId, day }).select("count").lean();
  return row?.count ?? 0;
};

module.exports = { FREE_PER_DAY, PREMIUM_PER_DAY, dayFor, limitFor, spend, refund, usedToday };

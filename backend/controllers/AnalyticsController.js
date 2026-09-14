const AnalyticsEvent = require("../models/AnalyticsEvent");
const { isEventName, FUNNEL_STEPS } = require("../services/analytics/events");

/** One flush is a screen's worth of events, not a day's. */
const MAX_BATCH = 50;

/** Enough for a species and a yes/no. Anything larger is a different feature. */
const MAX_PROPS_KEYS = 10;
const MAX_PROP_LENGTH = 200;

const PLATFORMS = ["ios", "android", "web"];

/**
 * Keeps the small, scalar, known-shaped part of whatever was sent.
 *
 * `props` is `Mixed`, which means Mongoose casts nothing and stores what it is
 * given - so this is a trust boundary and is treated as one. Objects and arrays
 * are dropped rather than walked: a nested structure here is either a mistake
 * or somebody using the analytics table as free storage, and neither is worth
 * supporting. Strings are cut rather than rejected, because losing the tail of
 * a breed name should not lose the event.
 */
const cleanProps = (props) => {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};

  const clean = {};
  for (const [key, value] of Object.entries(props).slice(0, MAX_PROPS_KEYS)) {
    if (typeof value === "string") clean[key] = value.slice(0, MAX_PROP_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean") clean[key] = value;
    // Anything else - an object, an array, a null, a date - is dropped.
  }
  return clean;
};

/**
 * A device clock is not trustworthy and not important enough to argue with.
 *
 * Events carry their own `at` so a batch flushed after an hour offline still
 * reports a ninety-second signup as ninety seconds. But a device with a wrong
 * clock would otherwise write events into 1970 or 2087 and quietly skew every
 * window. Anything outside a day either side falls back to now.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const cleanDate = (value, now = Date.now()) => {
  const at = new Date(value ?? now);
  if (Number.isNaN(at.getTime())) return new Date(now);
  if (Math.abs(at.getTime() - now) > DAY_MS) return new Date(now);
  return at;
};

/**
 * Product analytics, first-party.
 *
 * The app buffers events and posts them in batches. Two rules shape this
 * controller and both are about never being the reason something else breaks:
 *
 * 1. An unknown event name is dropped, not rejected. The app updates through an
 *    app store and the server does not, so there is always a window where a
 *    client is one version ahead and sending a name this table has not learnt
 *    yet. Answering 400 to that batch would throw away the known events in it
 *    too, and would do so precisely during a rollout.
 * 2. Identity comes from the token. `firebaseUid` is `req.firebaseUser.uid` and
 *    `userId` is `req.userId` - never the body. A client that could name its
 *    own uid could write events as anybody, which is the "identity taken from
 *    the body" hole `authAudit` exists to catch.
 */
const AnalyticsController = {
  /**
   * Records a batch.
   *
   * Answers 202 with what was kept. The count is for debugging a client, not
   * for the client to act on - there is nothing useful it could do about a
   * dropped event, and it must never retry one.
   */
  async record(req, res) {
    try {
      const batch = Array.isArray(req.body?.events) ? req.body.events : [];
      const now = Date.now();

      const platform = PLATFORMS.includes(req.body?.platform)
        ? req.body.platform
        : null;
      const appVersion =
        typeof req.body?.appVersion === "string"
          ? req.body.appVersion.slice(0, 40)
          : null;

      const rows = batch
        .slice(0, MAX_BATCH)
        .filter((event) => isEventName(event?.name))
        .map((event) => ({
          firebaseUid: req.firebaseUser.uid,
          userId: req.userId ?? null,
          name: event.name,
          props: cleanProps(event.props),
          platform,
          appVersion,
          at: cleanDate(event.at, now),
        }));

      if (rows.length > 0) await AnalyticsEvent.insertMany(rows, { ordered: false });

      res.status(202).json({ recorded: rows.length, received: batch.length });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * The funnel, as counts of distinct accounts per step.
   *
   * Safe only because its route carries `requireModerator` - this reads across
   * every account by design, which is the whole point of a funnel and is
   * exactly what `authAudit` is meant to stop by default. `GUARDED_READS`
   * pairs the two so dropping the guard fails a test rather than silently
   * publishing everybody's onboarding history.
   *
   * Distinct accounts, not raw events: somebody who opens the app eight times
   * is one person who opened the app, and a funnel counting otherwise reports
   * a first step that nothing could ever match.
   *
   * ponytail: no dashboard. This returns counts for a date range and is read by
   * hand. Build a real one when these numbers are being looked at weekly rather
   * than monthly - and not before, because the shape of the questions being
   * asked of it will decide what it should show.
   */
  async funnel(req, res) {
    try {
      const since = req.query.since ? new Date(req.query.since) : null;
      const until = req.query.until ? new Date(req.query.until) : null;

      const window = {};
      if (since && !Number.isNaN(since.getTime())) window.$gte = since;
      if (until && !Number.isNaN(until.getTime())) window.$lte = until;

      const match = Object.keys(window).length > 0 ? { at: window } : {};

      // One pass: distinct accounts per event name, then folded into steps
      // here. Grouping by step in the pipeline would need the table's ordering
      // expressed as a `$switch`, which is the table written twice.
      const counts = await AnalyticsEvent.aggregate([
        { $match: match },
        { $group: { _id: { name: "$name", uid: "$firebaseUid" } } },
        { $group: { _id: "$_id.name", users: { $sum: 1 } } },
      ]);

      const byName = Object.fromEntries(counts.map((row) => [row._id, row.users]));

      const steps = FUNNEL_STEPS.map(({ order, names }) => ({
        order,
        names,
        users: names.reduce((total, name) => total + (byName[name] ?? 0), 0),
      }));

      res.json({ steps, signals: byName, since: since ?? null, until: until ?? null });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = AnalyticsController;

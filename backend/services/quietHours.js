/**
 * Whether a push would land in somebody's quiet hours.
 *
 * Pure, and separate from `NotificationService`, because the interesting part
 * is arithmetic that no integration test would reach comfortably: a window
 * that wraps midnight. "22:00 to 07:00" is the obvious setting and the one a
 * naive `start <= now && now <= end` gets exactly backwards - it silences the
 * nine hours somebody is awake and lets every push through while they sleep.
 *
 * Times are wall-clock in the user's own zone. A quiet hour is a fact about
 * their evening, not an instant, so it has to stay 22:00 after they fly
 * somewhere - which a stored UTC instant would not.
 */

/** "HH:MM" -> minutes since midnight. Returns null for anything malformed. */
const toMinutes = (time) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time ?? ""));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

/** Local minutes-since-midnight for an instant at a given UTC offset. */
const localMinutes = (at, utcOffsetMinutes = 0) => {
  const utc = at.getUTCHours() * 60 + at.getUTCMinutes();
  // `+ 1440` twice so a negative offset past midnight still lands positive.
  return ((utc + utcOffsetMinutes) % 1440 + 1440) % 1440;
};

/**
 * Is `at` inside the window?
 *
 * A window whose start equals its end is treated as off rather than as 24
 * hours of silence: it is far more likely to be somebody who has not finished
 * setting it than somebody asking never to be told anything.
 */
const isQuiet = (quietHours, at = new Date()) => {
  if (!quietHours?.enabled) return false;

  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;

  const now = localMinutes(at, quietHours.utcOffsetMinutes ?? 0);

  // Same day: 09:00-17:00 is one span. Wrapping midnight: 22:00-07:00 is two.
  return start < end ? now >= start && now < end : now >= start || now < end;
};

module.exports = { isQuiet, toMinutes, localMinutes };

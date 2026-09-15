const ScheduledJob = require("../../models/ScheduledJob");
const User = require("../../models/User");
const Pet = require("../../models/Pet");
const scheduler = require("../scheduler");
const { notify } = require("../NotificationService");

/**
 * What Spot can do later.
 *
 * A reminder is one `ScheduledJob` of type `spot:reminder`: the scheduler
 * already running from Server.js claims it at its minute and the handler
 * below turns it into an ordinary notification - the row, the socket event,
 * the push, through `notify()` and nothing else - whose tap opens Spot with
 * the follow-up question prefilled. No tool runs at fire time: a reminder can
 * say something, never do something, while its owner is asleep.
 *
 * A repeating reminder is a series of one pending job at a time: when one
 * fires, the handler queues the next. Cancelling the pending job ends the
 * series; the status is `cancelled`, not deleted, so history stays.
 *
 * One writer, as with weights and playdates: the tool and the routes both
 * come here.
 */

const JOB = "spot:reminder";
const REPEATS = ["daily", "weekly", "monthly"];
const MAX_ACTIVE = 20;
const MAX_DAYS_AHEAD = 366;
const PAST_SLACK_MS = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const fail = (status, message) => Object.assign(new Error(message), { status });

const clampOffset = (minutes) => {
  const n = Number(minutes);
  return Number.isFinite(n) ? Math.max(-14 * 60, Math.min(14 * 60, n)) : 0;
};

/**
 * The next run of a series, on the owner's wall clock: daily and weekly add
 * whole days; monthly adds a month and clamps to the last day of the month,
 * so the 31st becomes the 28th in February and stays the 31st where it can.
 *
 * ponytail: the offset is the one captured when the reminder was set, so
 * across a daylight-saving change the local hour moves by an hour until the
 * reminder is set again. A zone name would fix it and nothing here stores one.
 */
const nextRunAt = (runAt, repeat, utcOffsetMinutes = 0) => {
  const offset = clampOffset(utcOffsetMinutes) * 60 * 1000;
  const local = new Date(new Date(runAt).getTime() + offset);
  if (repeat === "daily") local.setUTCDate(local.getUTCDate() + 1);
  else if (repeat === "weekly") local.setUTCDate(local.getUTCDate() + 7);
  else if (repeat === "monthly") {
    const day = local.getUTCDate();
    local.setUTCDate(1);
    local.setUTCMonth(local.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
    local.setUTCDate(Math.min(day, lastDay));
  } else return null;
  return new Date(local.getTime() - offset);
};

const publicReminder = (job) => ({
  reminderId: String(job._id),
  text: job.payload?.text ?? "",
  question: job.payload?.question ?? "",
  runAt: job.runAt,
  repeat: job.payload?.repeat ?? null,
  petId: job.payload?.petId ?? null,
});

/** Pending reminders of one owner, soonest first. */
const list = async (ownerId) => {
  const jobs = await ScheduledJob.find({ type: JOB, "payload.owner": String(ownerId), status: "pending" })
    .sort({ runAt: 1 })
    .lean();
  return jobs.map(publicReminder);
};

/**
 * Sets a reminder. `at` is anything `new Date()` reads; `question` is what
 * the tap asks Spot, defaulting to the reminder read back.
 */
const create = async ({ ownerId, text, question, at, repeat, petId, utcOffsetMinutes = 0, now = Date.now() }) => {
  const body = String(text ?? "").trim().slice(0, 140);
  if (!body) throw fail(400, "Say what to be reminded of");
  const runAt = new Date(at);
  if (Number.isNaN(runAt.getTime())) throw fail(400, "That isn't a time I can read");
  if (runAt.getTime() < now - PAST_SLACK_MS) throw fail(400, "That time has already passed");
  if (runAt.getTime() > now + MAX_DAYS_AHEAD * DAY) throw fail(400, "Reminders reach a year ahead, no further");
  if (repeat != null && !REPEATS.includes(repeat)) throw fail(400, "A reminder repeats daily, weekly or monthly, or not at all");

  const active = await ScheduledJob.countDocuments({ type: JOB, "payload.owner": String(ownerId), status: "pending" });
  if (active >= MAX_ACTIVE) throw fail(409, `Spot keeps up to ${MAX_ACTIVE} reminders. Cancel one first.`);

  const job = await scheduler.schedule(
    JOB,
    {
      owner: String(ownerId),
      text: body,
      question: String(question ?? "").trim().slice(0, 200) || `You asked me to remind you: ${body}`,
      repeat: repeat ?? null,
      petId: petId ? String(petId) : null,
      utcOffsetMinutes: clampOffset(utcOffsetMinutes),
    },
    runAt
  );
  return publicReminder(job);
};

/** Ends a reminder, or a series, that belongs to the caller. 404 otherwise. */
const cancel = async ({ ownerId, reminderId }) => {
  const job = await ScheduledJob.findOneAndUpdate(
    { _id: reminderId, type: JOB, "payload.owner": String(ownerId), status: "pending" },
    { $set: { status: "cancelled" } },
    { new: false }
  ).lean();
  if (!job) throw fail(404, "No such reminder");
  return publicReminder(job);
};

/** Everything an owner had pending, for account deletion. */
const removeAllFor = (ownerId) => ScheduledJob.deleteMany({ type: JOB, "payload.owner": String(ownerId) });

/**
 * Fires one. The owner is re-read rather than trusted: an account deleted
 * since the job was queued raises nothing. A repeat queues its successor
 * after the notification, so a failure to notify retries the same job rather
 * than creating a second series.
 */
scheduler.registerHandler(JOB, async (payload) => {
  const owner = await User.findById(payload.owner).select("_id").lean();
  if (!owner) return;
  const pet = payload.petId ? await Pet.findById(payload.petId).select("name").lean() : null;

  await notify({
    content: payload.text,
    recipientId: owner._id,
    type: "spotReminder",
    petName: pet?.name,
    data: { prefill: payload.question },
  });

  if (payload.repeat) {
    const current = await ScheduledJob.findOne({
      type: JOB,
      "payload.owner": payload.owner,
      "payload.text": payload.text,
      status: "running",
    })
      .select("runAt")
      .lean();
    const from = current?.runAt ?? new Date();
    const next = nextRunAt(from, payload.repeat, payload.utcOffsetMinutes);
    if (next) await scheduler.schedule(JOB, payload, next);
  }
});

module.exports = { JOB, REPEATS, MAX_ACTIVE, MAX_DAYS_AHEAD, nextRunAt, list, create, cancel, removeAllFor };

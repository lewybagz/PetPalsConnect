const cron = require("node-cron");
const ScheduledJob = require("../models/ScheduledJob");

// type -> async (payload) => void
const handlers = new Map();

/** Register a handler for a job type. */
const registerHandler = (type, fn) => {
  handlers.set(type, fn);
};

/** Enqueue work to run at (or after) `runAt`. */
const schedule = async (type, payload, runAt) => {
  if (!handlers.has(type)) {
    console.warn(`[scheduler] Scheduling unknown job type "${type}"`);
  }
  return ScheduledJob.create({ type, payload, runAt });
};

/** Convenience wrapper for "run this in N milliseconds". */
const scheduleIn = (type, payload, delayMs) =>
  schedule(type, payload, new Date(Date.now() + Math.max(0, delayMs)));

/**
 * Claim and run every job that is due.
 *
 * findOneAndUpdate on {status: "pending"} is atomic, so two server instances
 * racing on the same job will only let one of them win the claim.
 */
const drain = async () => {
  const now = new Date();

  for (;;) {
    const job = await ScheduledJob.findOneAndUpdate(
      { status: "pending", runAt: { $lte: now } },
      { $set: { status: "running" }, $inc: { attempts: 1 } },
      { new: true, sort: { runAt: 1 } }
    );

    if (!job) return;

    const handler = handlers.get(job.type);
    if (!handler) {
      await ScheduledJob.updateOne(
        { _id: job._id },
        { $set: { status: "failed", lastError: `No handler for type "${job.type}"` } }
      );
      continue;
    }

    try {
      await handler(job.payload);
      await ScheduledJob.updateOne({ _id: job._id }, { $set: { status: "completed" } });
    } catch (error) {
      const exhausted = job.attempts >= job.maxAttempts;
      await ScheduledJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: exhausted ? "failed" : "pending",
            lastError: error.message,
            // Back off a minute before the next attempt.
            ...(exhausted ? {} : { runAt: new Date(Date.now() + 60_000) }),
          },
        }
      );
      console.error(`[scheduler] Job ${job._id} (${job.type}) failed:`, error.message);
    }
  }
};

let task = null;

/** Start the once-a-minute drain loop. */
const start = () => {
  if (task) return task;
  task = cron.schedule("* * * * *", () => {
    drain().catch((err) => console.error("[scheduler] drain failed:", err.message));
  });
  console.log("[scheduler] Started (polling every minute)");
  return task;
};

const stop = () => {
  if (task) {
    task.stop();
    task = null;
  }
};

module.exports = { registerHandler, schedule, scheduleIn, drain, start, stop };

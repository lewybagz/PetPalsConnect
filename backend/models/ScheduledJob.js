const mongoose = require("mongoose");

/**
 * Durable delayed-job store.
 *
 * This replaces the previous Bull + Redis queue. The only queued work in this
 * app is a handful of low-volume, minute-granularity reminders, which does not
 * justify running (and paying for) a Redis instance. Jobs live in MongoDB and a
 * cron tick drains anything due.
 *
 * If job volume ever grows to the point where polling is a bottleneck,
 * reintroducing a real queue is a contained change behind services/scheduler.js.
 */
const scheduledJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    runAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError: { type: String },
  },
  { timestamps: true }
);

// Drives the "what is due right now" lookup.
scheduledJobSchema.index({ status: 1, runAt: 1 });

// Let MongoDB reap finished jobs after 30 days so the collection stays bounded.
scheduledJobSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: "completed" } }
);

module.exports = mongoose.model("ScheduledJob", scheduledJobSchema);

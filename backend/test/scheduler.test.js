const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let scheduler;
let ScheduledJob;

test.before(async () => {
  await harness.start();
  scheduler = require("../services/scheduler");
  ScheduledJob = require("../models/ScheduledJob");
});

test.after(async () => {
  scheduler.stop();
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

test("a due job runs and is marked completed", async () => {
  const ran = [];
  scheduler.registerHandler("test:ran", async (payload) => ran.push(payload));

  await scheduler.schedule("test:ran", { id: 1 }, new Date(Date.now() - 1000));
  await scheduler.drain();

  assert.deepEqual(ran, [{ id: 1 }]);
  const job = await ScheduledJob.findOne({ type: "test:ran" }).lean();
  assert.equal(job.status, "completed");
});

test("a job scheduled for the future is left alone", async () => {
  let calls = 0;
  scheduler.registerHandler("test:future", async () => {
    calls += 1;
  });

  await scheduler.schedule("test:future", {}, new Date(Date.now() + 60_000));
  await scheduler.drain();

  assert.equal(calls, 0);
  const job = await ScheduledJob.findOne({ type: "test:future" }).lean();
  assert.equal(job.status, "pending");
});

test("a failing job is retried, then marked failed once attempts run out", async () => {
  scheduler.registerHandler("test:flaky", async () => {
    throw new Error("boom");
  });

  await scheduler.schedule("test:flaky", {}, new Date(Date.now() - 1000));

  // First failure: back to pending with a back-off.
  await scheduler.drain();
  let job = await ScheduledJob.findOne({ type: "test:flaky" }).lean();
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.equal(job.lastError, "boom");

  // Exhaust the remaining attempts, making each due again first.
  for (let i = 0; i < 2; i += 1) {
    await ScheduledJob.updateOne({ _id: job._id }, { $set: { runAt: new Date(Date.now() - 1000) } });
    await scheduler.drain();
    job = await ScheduledJob.findOne({ type: "test:flaky" }).lean();
  }

  assert.equal(job.status, "failed");
  assert.equal(job.attempts, 3);
});

test("a job with no registered handler fails instead of hanging", async () => {
  await ScheduledJob.create({
    type: "test:unregistered",
    payload: {},
    runAt: new Date(Date.now() - 1000),
  });

  await scheduler.drain();

  const job = await ScheduledJob.findOne({ type: "test:unregistered" }).lean();
  assert.equal(job.status, "failed");
  assert.match(job.lastError, /No handler/);
});

test("claiming is atomic - concurrent drains do not double-run a job", async () => {
  let calls = 0;
  scheduler.registerHandler("test:once", async () => {
    calls += 1;
  });

  await scheduler.schedule("test:once", {}, new Date(Date.now() - 1000));
  await Promise.all([scheduler.drain(), scheduler.drain(), scheduler.drain()]);

  assert.equal(calls, 1);
});

test("scheduleIn converts a delay into a run time", async () => {
  scheduler.registerHandler("test:delay", async () => {});
  const job = await scheduler.scheduleIn("test:delay", {}, 5000);

  const delta = job.runAt.getTime() - Date.now();
  assert.ok(delta > 3000 && delta <= 5000, `unexpected runAt delta: ${delta}ms`);
});

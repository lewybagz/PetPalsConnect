const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let ScheduledJob;
let Notification;
let reminders;
let scheduler;
let client;

/**
 * A reminder is a promise the server keeps. These prove the arithmetic of
 * "next time", the limits, that a fired reminder is one notification whose
 * tap prefills Spot, that a series re-queues exactly once, that a cancelled
 * series is silent, and that nobody can cancel anybody else's.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  ScheduledJob = require("../models/ScheduledJob");
  Notification = require("../models/Notification");
  reminders = require("../services/spot/reminders");
  scheduler = require("../services/scheduler");
  client = require("../services/spot/client");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  process.env.ANTHROPIC_API_KEY = "test-key";
  client.setClient({});
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];
const makeOwner = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test`, spotConsentAt: new Date() });

const DAY = 24 * 60 * 60 * 1000;
const PHOENIX = -7 * 60;

test("nextRunAt keeps the owner's wall clock: whole days, and a month that clamps", () => {
  const at = new Date("2026-09-20T16:00:00.000Z"); // Sunday 09:00 in Phoenix
  assert.equal(reminders.nextRunAt(at, "daily", PHOENIX).toISOString(), "2026-09-21T16:00:00.000Z");
  assert.equal(reminders.nextRunAt(at, "weekly", PHOENIX).toISOString(), "2026-09-27T16:00:00.000Z");
  assert.equal(reminders.nextRunAt(at, "monthly", PHOENIX).toISOString(), "2026-10-20T16:00:00.000Z");
  // 31 January at 09:00 Phoenix, monthly: 28 February, then 28 March (never past the month's end).
  const jan31 = new Date("2026-01-31T16:00:00.000Z");
  const feb = reminders.nextRunAt(jan31, "monthly", PHOENIX);
  assert.equal(feb.toISOString(), "2026-02-28T16:00:00.000Z");
  // Across a UTC midnight boundary in the owner's zone: 23:30 in Tokyo is
  // 14:30Z the same day; the next day at 23:30 Tokyo is still 14:30Z.
  const tokyo = new Date("2026-03-01T14:30:00.000Z");
  assert.equal(reminders.nextRunAt(tokyo, "daily", 9 * 60).toISOString(), "2026-03-02T14:30:00.000Z");
  assert.equal(reminders.nextRunAt(at, "yearly", PHOENIX), null);
  assert.equal(reminders.nextRunAt(at, null, PHOENIX), null);
});

test("create refuses the past, the far future, a bad repeat, and a 21st reminder - with the right status", async () => {
  const alice = await makeOwner("alice");
  const now = Date.now();
  const soon = new Date(now + DAY).toISOString();
  const refused = async (fields, status, pattern) => {
    await assert.rejects(reminders.create({ ownerId: alice._id, text: "x", at: soon, now, ...fields }), (err) => {
      assert.equal(err.status, status, err.message);
      assert.match(err.message, pattern);
      return true;
    });
  };
  await refused({ at: new Date(now - 5 * 60 * 1000).toISOString() }, 400, /already passed/);
  await refused({ at: new Date(now + 400 * DAY).toISOString() }, 400, /a year ahead/);
  await refused({ at: "next friday" }, 400, /can't|isn't a time/);
  await refused({ repeat: "yearly" }, 400, /daily, weekly or monthly/);
  await refused({ text: "   " }, 400, /Say what/);

  // A minute of slack for a time that was "now" when the person typed it.
  await reminders.create({ ownerId: alice._id, text: "now-ish", at: new Date(now - 20 * 1000).toISOString(), now });
  for (let i = 0; i < 19; i += 1) await reminders.create({ ownerId: alice._id, text: `r${i}`, at: soon, now });
  await refused({}, 409, /up to 20/);
  assert.equal(await ScheduledJob.countDocuments({ type: reminders.JOB }), 20);
});

test("a due reminder becomes one notification whose tap prefills Spot; a series re-queues exactly once", async () => {
  const alice = await makeOwner("alice");
  const at = new Date(Date.now() - 1000);
  const once = await reminders.create({
    ownerId: alice._id,
    text: "book Bella's booster",
    at: at.toISOString(),
    now: at.getTime(),
  });
  const weekly = await reminders.create({
    ownerId: alice._id,
    text: "clean the tank",
    question: "Did the tank get cleaned?",
    at: at.toISOString(),
    repeat: "weekly",
    utcOffsetMinutes: PHOENIX,
    now: at.getTime(),
  });

  await scheduler.drain();

  const rows = await Notification.find({ recipient: alice._id }).sort({ content: 1 }).lean();
  assert.deepEqual(
    rows.map((row) => [row.type, row.content, row.data?.prefill]),
    [
      ["spotReminder", "book Bella's booster", "You asked me to remind you: book Bella's booster"],
      ["spotReminder", "clean the tank", "Did the tank get cleaned?"],
    ]
  );

  const jobs = await ScheduledJob.find({ type: reminders.JOB }).sort({ runAt: 1 }).lean();
  assert.deepEqual(jobs.map((job) => job.status), ["completed", "completed", "pending"]);
  const next = jobs[2];
  assert.equal(next.payload.text, "clean the tank");
  assert.equal(next.runAt.getTime(), at.getTime() + 7 * DAY, "one week on, same hour");
  assert.equal(String(next._id) !== weekly.reminderId, true, "a new job, not the old one moved");
  assert.equal(String(next._id) !== once.reminderId, true);

  // Draining again does nothing: the next run is a week away.
  await scheduler.drain();
  assert.equal(await Notification.countDocuments({ recipient: alice._id }), 2);
});

test("a cancelled series is silent, and only its owner can cancel it", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const at = new Date(Date.now() - 1000);
  const series = await reminders.create({
    ownerId: alice._id,
    text: "walk",
    at: at.toISOString(),
    repeat: "daily",
    now: at.getTime(),
  });

  await assert.rejects(reminders.cancel({ ownerId: bob._id, reminderId: series.reminderId }), (err) => err.status === 404);
  assert.equal((await ScheduledJob.findById(series.reminderId).lean()).status, "pending", "Bob changed nothing");

  const ended = await reminders.cancel({ ownerId: alice._id, reminderId: series.reminderId });
  assert.equal(ended.text, "walk");
  assert.equal(ended.repeat, "daily");
  assert.equal((await ScheduledJob.findById(series.reminderId).lean()).status, "cancelled");
  await assert.rejects(reminders.cancel({ ownerId: alice._id, reminderId: series.reminderId }), (err) => err.status === 404);

  await scheduler.drain();
  assert.equal(await Notification.countDocuments({ recipient: alice._id }), 0);
  assert.equal(await ScheduledJob.countDocuments({ type: reminders.JOB }), 1, "no successor was queued");
  assert.deepEqual(await reminders.list(alice._id), []);
});

test("a reminder for a deleted account fires nothing, and deleting the account removes its jobs", async () => {
  const alice = await makeOwner("alice");
  const at = new Date(Date.now() - 1000);
  await reminders.create({ ownerId: alice._id, text: "gone", at: at.toISOString(), now: at.getTime() });
  await reminders.create({ ownerId: alice._id, text: "later", at: new Date(Date.now() + DAY).toISOString() });

  await request(app).delete("/api/users/me").set(...auth("alice")).expect(200);
  assert.equal(await ScheduledJob.countDocuments({ type: reminders.JOB }), 0);

  // And a job that somehow outlives its owner raises nothing.
  await ScheduledJob.create({ type: reminders.JOB, payload: { owner: String(alice._id), text: "ghost", question: "?" }, runAt: at });
  await scheduler.drain();
  assert.equal(await Notification.countDocuments({}), 0);
});

test("the routes are the caller's own, and the switch governs the push", async () => {
  const alice = await makeOwner("alice");
  await makeOwner("bob");
  const at = new Date(Date.now() + DAY).toISOString();

  const created = await request(app)
    .post("/api/spot/reminders")
    .set(...auth("alice"))
    .send({ text: "vet at 3", at, utcOffsetMinutes: PHOENIX })
    .expect(201);
  assert.equal(created.body.text, "vet at 3");
  await request(app).post("/api/spot/reminders").set(...auth("alice")).send({ text: "", at }).expect(400);

  const mine = await request(app).get("/api/spot/reminders").set(...auth("alice")).expect(200);
  assert.deepEqual(mine.body.map((row) => row.reminderId), [created.body.reminderId]);
  const theirs = await request(app).get("/api/spot/reminders").set(...auth("bob")).expect(200);
  assert.deepEqual(theirs.body, []);
  await request(app).delete(`/api/spot/reminders/${created.body.reminderId}`).set(...auth("bob")).expect(404);
  await request(app).delete(`/api/spot/reminders/${created.body.reminderId}`).set(...auth("alice")).expect(200);
  await request(app).delete(`/api/spot/reminders/${created.body.reminderId}`).set(...auth("alice")).expect(404);

  const { CATEGORIES, categoryFor } = require("../services/notificationTypes");
  assert.equal(categoryFor("spotReminder"), "spotReminders");
  assert.ok(CATEGORIES.some((category) => category.key === "spotReminders"));
  const UserPreferences = require("../models/UserPreferences");
  await UserPreferences.create({ user: alice._id, notificationPreferences: { spotReminders: false } });
  const { wantsPush } = require("../services/NotificationService");
  assert.equal(await wantsPush(alice._id, "spotReminder"), false);
  assert.equal(await wantsPush(alice._id, "vaccinationDue"), true, "only Spot's switch moved");

  delete process.env.ANTHROPIC_API_KEY;
  await request(app).get("/api/spot/reminders").set(...auth("alice")).expect(503);
});

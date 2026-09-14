const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let User;
let Report;
let SupportMessage;
let AnalyticsEvent;
let retention;

/**
 * The privacy policy says reports and support messages are kept for up to
 * three years. This is the job that makes that true; the test is that a row
 * a day past the window goes and one a day inside it stays.
 */
test.before(async () => {
  await harness.start();
  User = require("../models/User");
  Report = require("../models/Report");
  SupportMessage = require("../models/SupportMessage");
  AnalyticsEvent = require("../models/AnalyticsEvent");
  retention = require("../services/retention");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const DAY = 24 * 60 * 60 * 1000;

test("rows older than the window are removed; newer ones stay", async () => {
  const now = new Date("2029-01-01T00:00:00Z");
  const old = new Date(now.getTime() - (retention.RETENTION_DAYS + 1) * DAY);
  const recent = new Date(now.getTime() - (retention.RETENTION_DAYS - 1) * DAY);

  const reporter = await User.create({ firebaseUid: "r1", username: "r1", email: "r1@example.test" });
  const reported = await User.create({ firebaseUid: "r2", username: "r2", email: "r2@example.test" });
  const { REPORT_REASONS, REPORT_TARGETS } = require("../services/reportStates");
  // The unique index is (reporter, reportedUser, reportedContent), so each
  // row reports a different thing.
  let n = 0;
  const report = (createdDate) =>
    Report.create({
      content: "x",
      reportedContent: `content-${n++}`,
      reportedContentType: REPORT_TARGETS[0],
      reporter: reporter._id,
      reportedUser: reported._id,
      reason: REPORT_REASONS[0],
      creator: reporter._id,
      createdDate,
    });
  await report(old);
  await report(recent);

  // `timestamps: true` sets createdAt itself; write the old date underneath it.
  const oldTicket = await SupportMessage.create({ name: "a", email: "a@example.test", message: "help" });
  await SupportMessage.collection.updateOne({ _id: oldTicket._id }, { $set: { createdAt: old } });
  await SupportMessage.create({ name: "b", email: "b@example.test", message: "help" });

  const result = await retention.purgeExpired(now);

  assert.equal(result.reports, 1);
  assert.equal(result.support, 1);
  assert.equal(await Report.countDocuments(), 1);
  assert.equal(await SupportMessage.countDocuments(), 1);
});

test("the window is the three years the policy names", () => {
  assert.equal(retention.RETENTION_DAYS, 1095);
  const now = new Date("2029-01-01T00:00:00Z");
  const days = (now - retention.cutoffFor(now)) / (24 * 60 * 60 * 1000);
  assert.equal(days, 1095);
});

test("analytics events are purged on their own, much shorter, window", async () => {
  const now = new Date("2029-01-01T00:00:00Z");
  const days = retention.ANALYTICS_RETENTION_DAYS;
  const old = new Date(now.getTime() - (days + 1) * DAY);
  const recent = new Date(now.getTime() - (days - 1) * DAY);

  await AnalyticsEvent.create({ firebaseUid: "u1", name: "app_opened", at: old });
  await AnalyticsEvent.create({ firebaseUid: "u2", name: "app_opened", at: recent });

  const result = await retention.purgeExpired(now);

  assert.equal(result.analytics, 1);
  assert.equal(await AnalyticsEvent.countDocuments(), 1);
});

test("the analytics window is far shorter than the ones for records people may need", () => {
  // Reports and orders are kept because somebody may need them; a funnel
  // event is deleted because nobody will.
  assert.equal(retention.ANALYTICS_RETENTION_DAYS, 90);
  assert.ok(retention.ANALYTICS_RETENTION_DAYS < retention.RETENTION_DAYS);
});

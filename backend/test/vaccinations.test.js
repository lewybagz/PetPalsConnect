const test = require("node:test");
const assert = require("node:assert/strict");

const {
  statusOf,
  reminderAt,
  isShared,
  nextFrom,
  categoryOf,
  KINDS,
  REMINDER_LEAD_MS,
} = require("../services/vaccinations");

/**
 * The status boundaries, with no database.
 *
 * `statusOf` is what the deck card, the owner's screen and the reminder all
 * read, so a wrong edge here is wrong in three places at once.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-09T12:00:00Z");
const at = (days) => new Date(NOW + days * DAY);

const record = (kind, extra = {}) => ({
  kind,
  administeredAt: at(-30),
  ...extra,
});

const core = (expiryDays) => [
  record("rabies", { expiresAt: at(expiryDays) }),
  record("dhpp", { expiresAt: at(expiryDays) }),
  record("bordetella", { expiresAt: at(expiryDays) }),
];

test("no records is unknown, not expired", () => {
  assert.equal(statusOf([], NOW), "unknown");
});

test("all three core vaccines with future expiries is current", () => {
  assert.equal(statusOf(core(365), NOW), "current");
});

test("a core vaccine due within the lead time is expiring soon", () => {
  assert.equal(statusOf(core(29), NOW), "expiringSoon");
  // Exactly at the boundary counts as soon: the reminder for it is due today.
  assert.equal(statusOf(core(30), NOW), "expiringSoon");
  assert.equal(statusOf(core(31), NOW), "current");
});

test("a lapsed core vaccine is expired, whatever else is there", () => {
  const records = [...core(365), record("rabies", { administeredAt: at(-10), expiresAt: at(-1) })];
  // The newest rabies record is the one that counts, and it has lapsed.
  assert.equal(statusOf(records, NOW), "expired");
});

test("expired outranks partial", () => {
  const records = [record("rabies", { expiresAt: at(-1) })];
  assert.equal(statusOf(records, NOW), "expired");
});

test("a missing core vaccine is partial", () => {
  const records = [record("rabies", { expiresAt: at(365) }), record("dhpp", { expiresAt: at(365) })];
  assert.equal(statusOf(records, NOW), "partial");
});

test("a non-core vaccine on its own does not make a pet current", () => {
  assert.equal(statusOf([record("influenza", { expiresAt: at(365) })], NOW), "partial");
});

test("a record with no expiry never lapses", () => {
  const records = [record("rabies"), record("dhpp"), record("bordetella")];
  assert.equal(statusOf(records, NOW), "current");
});

test("only current and expiring-soon count as shared", () => {
  assert.equal(isShared("current"), true);
  assert.equal(isShared("expiringSoon"), true);
  assert.equal(isShared("partial"), false);
  assert.equal(isShared("expired"), false);
  assert.equal(isShared("unknown"), false);
});

test("preventatives, visits and medications never change the vaccination status", () => {
  // A flea record on its own has shared nothing about vaccinations.
  assert.equal(statusOf([record("fleaTick", { expiresAt: at(20) })], NOW), "unknown");
  // And an expired one beside a current core set does not lapse it.
  const records = [...core(365), record("heartworm", { expiresAt: at(-5) })];
  assert.equal(statusOf(records, NOW), "current");
});

test("every kind has a category", () => {
  for (const kind of KINDS) assert.ok(categoryOf(kind), `${kind} has no category`);
  assert.equal(categoryOf("rabies"), "vaccine");
  assert.equal(categoryOf("fleaTick"), "prevention");
  assert.equal(categoryOf("vetVisit"), "visit");
  assert.equal(categoryOf("medication"), "medication");
  assert.equal(categoryOf("homeopathy"), null);
});

test("done writes the next dose one interval on, and only for records that repeat", () => {
  const next = nextFrom(
    { kind: "fleaTick", intervalDays: 30, label: undefined, expiresAt: at(-2) },
    NOW
  );
  assert.equal(next.kind, "fleaTick");
  assert.equal(next.intervalDays, 30);
  assert.equal(next.administeredAt.getTime(), NOW);
  assert.equal(next.expiresAt.getTime(), NOW + 30 * DAY);

  const medication = nextFrom({ kind: "medication", label: "Apoquel", intervalDays: 1 }, NOW);
  assert.equal(medication.label, "Apoquel");

  // A vaccine has a certificate date, not a cycle.
  assert.equal(nextFrom({ kind: "rabies", expiresAt: at(365) }, NOW), null);
  assert.equal(nextFrom(null, NOW), null);
});

test("a reminder lands one lead time before expiry, never in the past", () => {
  assert.equal(reminderAt(at(365), NOW).getTime(), NOW + 365 * DAY - REMINDER_LEAD_MS);
  // Due inside the lead time: remind now rather than never.
  assert.equal(reminderAt(at(5), NOW).getTime(), NOW);
  assert.equal(reminderAt(at(-1), NOW), null);
  assert.equal(reminderAt(undefined, NOW), null);
});

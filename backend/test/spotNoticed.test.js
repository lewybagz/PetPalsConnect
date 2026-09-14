const test = require("node:test");
const assert = require("node:assert/strict");

const { noticesFor, MAX_NOTICES } = require("../services/spot/noticed");

/**
 * The "Spot noticed" card is software over the app's own data. Each kind, the
 * order between them, the cap, and - the case that matters most - a healthy,
 * up-to-date pet producing nothing.
 */

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-14T12:00:00Z").getTime();
const bella = { petId: "p1", name: "Bella", species: "dog", recordCount: 3 };
const miso = { petId: "p2", name: "Miso", species: "cat", recordCount: 1 };
const kiwi = { petId: "p3", name: "Kiwi", species: "bird", recordCount: 0 };

const recent = new Map([["p1", new Date(now - 10 * DAY)], ["p2", new Date(now - 10 * DAY)]]);

test("a healthy, weighed, current pet gets no notice at all", () => {
  const notices = noticesFor({
    now,
    pets: [bella],
    statuses: new Map([["p1", "current"]]),
    lastWeighed: recent,
  });
  assert.deepEqual(notices, []);
});

test("an invitation to the caller comes first and opens the playdate", () => {
  const notices = noticesFor({
    now,
    pets: [bella],
    statuses: new Map([["p1", "expired"]]),
    lastWeighed: recent,
    pendingPlaydates: [{ playdateId: "pd-1", organiser: "alex", date: new Date(now + DAY) }],
  });
  assert.equal(notices[0].kind, "invitation");
  assert.equal(notices[0].text, "@alex's playdate invitation is waiting for an answer.");
  assert.equal(notices[0].question, "What's the playdate invitation from alex about?");
  assert.deepEqual([notices[0].screen, notices[0].params], ["PlaydateDetails", { playdateId: "pd-1" }]);
  assert.equal(notices[1].kind, "vaccine");
});

test("the three vaccination states each say what they mean, and 'current' and 'unknown' say nothing", () => {
  const text = (status) =>
    noticesFor({ now, pets: [bella], statuses: new Map([["p1", status]]), lastWeighed: recent }).map((n) => n.text);
  assert.deepEqual(text("expired"), ["Bella's core vaccinations have lapsed."]);
  assert.deepEqual(text("expiringSoon"), ["One of Bella's vaccinations is due within 30 days."]);
  assert.deepEqual(text("partial"), ["Bella's records are missing a core vaccine."]);
  assert.deepEqual(text("current"), []);
  assert.deepEqual(text("unknown"), []);
  const [notice] = noticesFor({ now, pets: [bella], statuses: new Map([["p1", "expired"]]), lastWeighed: recent });
  assert.equal(notice.question, "Is Bella due for anything?", "the device answers this one for free");
});

test("a repeating treatment is a notice inside seven days, overdue included, and not beyond", () => {
  const due = (days, extra = {}) =>
    noticesFor({
      now,
      pets: [bella],
      statuses: new Map([["p1", "current"]]),
      lastWeighed: recent,
      dueRecords: [{ recordId: "r1", petId: "p1", kind: "fleaTick", expiresAt: new Date(now + days * DAY), ...extra }],
    });
  assert.equal(due(3)[0].text, "Bella's flea and tick treatment is due in 3 days.");
  assert.equal(due(0)[0].text, "Bella's flea and tick treatment is due today.");
  assert.equal(due(1)[0].text, "Bella's flea and tick treatment is due tomorrow.");
  assert.equal(due(-2)[0].text, "Bella's flea and tick treatment was due 2 days ago.");
  assert.equal(due(2, { kind: "medication", label: "Apoquel" })[0].text, "Bella's Apoquel is due in 2 days.");
  assert.deepEqual(due(8), [], "eight days out is next week's problem");
  assert.equal(due(3)[0].question, "What is due for Bella this week?");
});

test("a dog or cat not weighed in ninety days is a notice; a bird never is; never weighed says so", () => {
  const notices = noticesFor({
    now,
    pets: [bella, miso, kiwi],
    statuses: new Map([["p1", "current"], ["p2", "current"], ["p3", "current"]]),
    lastWeighed: new Map([["p1", new Date(now - 120 * DAY)], ["p2", new Date(now - 89 * DAY)]]),
  });
  const weights = notices.filter((n) => n.kind === "weight");
  assert.deepEqual(weights.map((n) => n.text), ["Bella hasn't been weighed in 4 months."]);
  assert.equal(weights[0].question, "Log a weigh-in for Bella");
  const never = noticesFor({ now, pets: [miso], statuses: new Map([["p2", "current"]]) });
  assert.equal(never[0].text, "Miso has never been weighed here.");
});

test("a pet with no records is the last kind, and the list stops at three", () => {
  const notices = noticesFor({
    now,
    pets: [bella, miso, kiwi],
    statuses: new Map([["p1", "expired"], ["p2", "partial"], ["p3", "unknown"]]),
    lastWeighed: new Map(),
    pendingPlaydates: [{ playdateId: "pd-1", organiser: "alex", date: new Date(now + DAY) }],
  });
  assert.equal(notices.length, MAX_NOTICES);
  assert.deepEqual(notices.map((n) => n.kind), ["invitation", "vaccine", "vaccine"]);

  const onlyRecords = noticesFor({ now, pets: [kiwi], statuses: new Map([["p3", "unknown"]]) });
  assert.deepEqual(onlyRecords.map((n) => [n.kind, n.text, n.question]), [
    ["records", "Kiwi has no health records yet.", "Add Kiwi's vaccination dates"],
  ]);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appHelp = require("../services/appHelp");
const { SCREENS } = require("../services/spot/blocks");

/**
 * The help table is what Spot and the help screen both say about the app.
 * Shape is checked here; truth is a reviewed diff.
 */

test("every entry is plain, answers something, names a topic, and points at a real screen or none", () => {
  const registered = new Set(
    [...fs
      .readFileSync(path.resolve(__dirname, "../../PetPalsConnectApp/src/screens/navigation/AppStack.js"), "utf8")
      .matchAll(/name="(\w+)"/g)].map((m) => m[1])
  );
  const ids = new Set();
  for (const entry of appHelp.HELP) {
    assert.ok(entry.id && !ids.has(entry.id), `duplicate or missing id: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(appHelp.TOPICS[entry.topic], `${entry.id}: unknown topic ${entry.topic}`);
    assert.ok(entry.question.endsWith("?") || entry.question.endsWith("."), `${entry.id}: a question`);
    assert.ok(entry.answer.length > 40, `${entry.id}: an answer`);
    assert.ok(entry.answer.split(/(?<=[.!?])\s+/).length <= 5, `${entry.id}: under five sentences`);
    assert.doesNotMatch(entry.answer, /[*#_`]|\[[^\]]+\]\(/, `${entry.id}: no markdown, nothing renders it`);
    assert.doesNotMatch(entry.answer, /\$\s?\d|\d+(\.\d+)?\s?(a|per)\s(month|year)/i, `${entry.id}: no prices`);
    assert.doesNotMatch(entry.answer, /\bverified\b/i, `${entry.id}: never "verified" about a record`);
    if (entry.screen !== null) {
      assert.ok(registered.has(entry.screen), `${entry.id}: AppStack does not register ${entry.screen}`);
      // The help screen's Open button sends no params, so a screen that needs
      // a pet or a chat to show anything opens blank. Spot's table says which.
      assert.ok(!SCREENS[entry.screen]?.param, `${entry.id}: ${entry.screen} needs a ${SCREENS[entry.screen]?.param}`);
    }
  }
  assert.ok(appHelp.HELP.length >= 100);
  for (const topic of Object.keys(appHelp.TOPICS)) {
    assert.ok(appHelp.HELP.filter((entry) => entry.topic === topic).length >= 5, `${topic}: a topic with fewer than five answers`);
  }
});

test("every number in an answer is one the code holds", () => {
  const byId = Object.fromEntries(appHelp.HELP.map((entry) => [entry.id, entry.answer]));
  const retention = require("../services/retention");
  const share = require("../models/TrackingShare");
  const quota = require("../services/spot/quota");
  assert.equal(retention.RETENTION_DAYS, 3 * 365);
  assert.match(byId["data-retention"], /three years/);
  assert.equal(retention.ORDER_RETENTION_DAYS, 7 * 365);
  assert.match(byId["order-shipped"], /seven years/);
  assert.equal(share.DEFAULT_HOURS, 24);
  assert.equal(share.MAX_HOURS, 7 * 24);
  assert.match(byId["collar-share"], /a day unless you say otherwise and a week at most/);
  assert.equal(require("../models/DevicePosition").RETENTION_DAYS, 30);
  assert.match(byId["collar-share"], /thirty days/);
  assert.equal(quota.FREE_PER_DAY, 3);
  const emergency = require("../services/petCare/emergency");
  for (const contact of emergency.EMERGENCY_CONTACTS) {
    assert.ok(byId["emergency-numbers"].includes(contact.phone), `${contact.name}'s number is not in the answer`);
  }
  const { DESTINATIONS } = require("../services/destinations");
  for (const city of DESTINATIONS) assert.ok(byId.destinations.includes(city.name), city.name);
  const { KIND_CATEGORIES } = require("../services/vaccinations");
  assert.equal(Object.keys(KIND_CATEGORIES).length, 12);
  const { WEIGHTS } = require("../services/matching/score");
  const [first, second] = Object.entries(WEIGHTS).sort((a, b) => b[1] - a[1]);
  assert.deepEqual([first[0], second[0]], ["temperament", "size"], "match-score says temperament and size lead");
});

test("search ranks the entry whose question matches first, and finds nothing for nothing", () => {
  assert.equal(appHelp.search("why is my deck empty")[0].id, "deck-empty-region");
  assert.equal(appHelp.search("what does premium change")[0].id, "premium");
  assert.equal(appHelp.search("delete my account")[0].id, "delete-account");
  assert.equal(appHelp.search("can spot remind me")[0].id, "spot-reminders");
  assert.equal(appHelp.search("who can accept a playdate")[0].id, "playdate-accept");
  assert.equal(appHelp.search("how do i cancel premium")[0].id, "subscription-cancel");
  assert.equal(appHelp.search("what are the emergency numbers")[0].id, "emergency-numbers");
  assert.equal(appHelp.search("what does the tracking collar do")[0].id, "collar-what");
  assert.equal(appHelp.search("can i talk to spot")[0].id, "spot-voice");
  assert.equal(appHelp.search("can i make a group chat")[0].id, "group-chats");
  assert.equal(appHelp.search("why was my message refused")[0].id, "language-filter");
  assert.equal(appHelp.search("how do i change my password")[0].id, "change-password");
  assert.deepEqual(appHelp.search("zzz qqq"), []);
  assert.deepEqual(appHelp.search("the a is"), [], "stop words alone match nothing");
  assert.ok(appHelp.search("cat").length <= 5);
});

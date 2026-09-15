const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appHelp = require("../services/appHelp");

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
    }
  }
  assert.ok(appHelp.HELP.length >= 30);
});

test("search ranks the entry whose question matches first, and finds nothing for nothing", () => {
  assert.equal(appHelp.search("why is my deck empty")[0].id, "deck-empty-region");
  assert.equal(appHelp.search("what does premium change")[0].id, "premium");
  assert.equal(appHelp.search("delete my account")[0].id, "delete-account");
  assert.equal(appHelp.search("can spot remind me")[0].id, "spot-reminders");
  assert.equal(appHelp.search("who can accept a playdate")[0].id, "playdate-accept");
  assert.deepEqual(appHelp.search("zzz qqq"), []);
  assert.deepEqual(appHelp.search("the a is"), [], "stop words alone match nothing");
  assert.ok(appHelp.search("cat").length <= 5);
});

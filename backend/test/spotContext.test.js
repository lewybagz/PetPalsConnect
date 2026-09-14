const test = require("node:test");
const assert = require("node:assert/strict");

const { contextBlock, localClock } = require("../services/spot/context");
const { historyMessages, HISTORY_WINDOW } = require("../services/spot/runner");
const { costOf, PRICES } = require("../services/spot/client");

/**
 * The text the model is handed about the owner, and the shape of history.
 * Both are software: a roster line that is wrong is a wrong name in an
 * answer, and a window that is off by one is a turn paid for twice.
 */

const noon = new Date("2026-09-13T19:05:00.000Z"); // 12:05 in Phoenix (UTC-7)

test("the clock is the owner's wall clock, from the offset the app sends", () => {
  assert.deepEqual(localClock(noon, -420), { date: "2026-09-13", time: "12:05", weekday: "Sunday" });
  // Past midnight in Tokyo is already Monday.
  assert.deepEqual(localClock(noon, 540), { date: "2026-09-14", time: "04:05", weekday: "Monday" });
  // Junk and out-of-range offsets fall back to UTC and the widest real zone.
  assert.equal(localClock(noon, "what").time, "19:05");
  assert.equal(localClock(noon, 100000).time, "09:05");
});

test("the block names every pet with its id, the units, and the notes", () => {
  const text = contextBlock({
    now: noon,
    utcOffsetMinutes: -420,
    units: { distance: "km", weight: "kg" },
    pets: [
      { petId: "p1", name: "Bella", species: "dog", breed: "Beagle", age: 4, weight: 40, weighedOn: "2026-09-12", vaccinationStatus: "current" },
      { petId: "p2", name: "Miso", species: "cat", age: 1, weight: 8.5, vaccinationStatus: "unknown" },
    ],
    notes: ["Bella is scared of thunderstorms"],
  });
  assert.match(text, /^Today is Sunday 2026-09-13, 12:05 where the owner is\./);
  assert.match(text, /reads kilometres and kilograms; weights below are stored in pounds/);
  assert.match(text, /- Bella \(petId p1\): dog, Beagle, 4 years, 40 lb \(18\.1 kg\) weighed 2026-09-12, vaccinations current/);
  assert.match(text, /- Miso \(petId p2\): cat, 1 year, 8\.5 lb \(3\.9 kg\), vaccinations unknown/);
  assert.match(text, /Things the owner asked you to remember:\n- Bella is scared of thunderstorms/);
});

test("no pets and no notes is said plainly, and pounds carry no conversion", () => {
  const text = contextBlock({ now: noon, pets: [], notes: [] });
  assert.match(text, /Pets: none on the profile yet\./);
  assert.ok(!text.includes("remember"));
  const one = contextBlock({ now: noon, pets: [{ petId: "p", name: "Rex", species: "dog", weight: 20 }] });
  assert.match(one, /20 lb, vaccinations unknown/);
  assert.ok(!one.includes("kg"));
});

test("history keeps the newest window and puts the cache breakpoint on its last message", () => {
  const long = Array.from({ length: HISTORY_WINDOW + 7 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    text: `m${i}`,
  }));
  const history = historyMessages(long);
  assert.equal(history.length, HISTORY_WINDOW);
  assert.equal(history[0].content, `m${7}`, "the oldest seven are dropped");
  const last = history[history.length - 1];
  assert.deepEqual(last.content, [
    { type: "text", text: `m${HISTORY_WINDOW + 6}`, cache_control: { type: "ephemeral" } },
  ]);
  assert.equal(typeof history[history.length - 2].content, "string", "only the last carries a breakpoint");
  // Software turns with no text are not history.
  assert.deepEqual(historyMessages([{ role: "user", text: "" }]), []);
});

test("cost follows the price table, and an unknown model is null rather than zero", () => {
  const usage = { input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 400_000 };
  const opus = PRICES["claude-opus-5"];
  const expected = opus.input + 0.1 * opus.output + 0.2 * opus.input + 0.4 * opus.input * 1.25;
  assert.equal(costOf(usage, "claude-opus-5"), Number(expected.toFixed(4)));
  assert.equal(costOf({}, "claude-opus-5"), 0);
  assert.equal(costOf(usage, "claude-3-opus-20240229"), null);
});

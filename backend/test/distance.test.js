const test = require("node:test");
const assert = require("node:assert/strict");

const {
  milesBetween,
  rangeToMiles,
  toCoordinates,
  withinRange,
  formatMiles,
  isValidCoordinates,
} = require("../services/matching/distance");

/**
 * Distance, the dimension matching did not have.
 *
 * Scoring compared temperament, size, activities, breed and age, and nothing
 * anywhere knew how far apart two people were - so discovery could offer a
 * perfect match on another continent, and `playdateRange` was a preference
 * that enforced nothing.
 *
 * Pure functions, so these need no database.
 */

// Longitude first. Saying it out loud the other way round is how London ends
// up in Antarctica.
const LONDON = [-0.1276, 51.5072];
const BRIGHTON = [-0.1372, 50.8225];
const NEW_YORK = [-74.006, 40.7128];

test("distance between two nearby cities is about right", () => {
  const miles = milesBetween(LONDON, BRIGHTON);

  // London to Brighton is roughly 47 miles as the crow flies.
  assert.ok(miles > 44 && miles < 50, `expected ~47, got ${miles}`);
});

test("distance across an ocean is about right", () => {
  const miles = milesBetween(LONDON, NEW_YORK);

  assert.ok(miles > 3400 && miles < 3500, `expected ~3460, got ${miles}`);
});

test("the same point is no distance at all", () => {
  assert.equal(milesBetween(LONDON, LONDON), 0);
});

test("distance is symmetric", () => {
  assert.equal(
    Math.round(milesBetween(LONDON, NEW_YORK)),
    Math.round(milesBetween(NEW_YORK, LONDON))
  );
});

test("missing or malformed coordinates measure nothing, rather than zero", () => {
  // Returning 0 would put every user without a position on top of you.
  assert.equal(milesBetween(null, LONDON), null);
  assert.equal(milesBetween(LONDON, undefined), null);
  assert.equal(milesBetween(["a", "b"], LONDON), null);
  assert.equal(milesBetween([1], LONDON), null);
});

test("a range in miles is used as given, and 0 means no limit", () => {
  assert.equal(rangeToMiles(25), 25);
  assert.equal(rangeToMiles(0), null);
  assert.equal(rangeToMiles(-5), null);
  assert.equal(rangeToMiles(undefined), null);
});

test("the enum this used to be still resolves", () => {
  // A preference someone set before it became a number should not silently
  // turn into "everywhere".
  assert.equal(rangeToMiles("Within 10 miles"), 10);
  assert.equal(rangeToMiles("Within 50 miles"), 50);
  assert.equal(rangeToMiles("All"), null);
  assert.equal(rangeToMiles("Within 5 parsecs"), null);
});

test("coordinates are validated before they are stored", () => {
  assert.ok(isValidCoordinates(LONDON));
  assert.ok(!isValidCoordinates([200, 51]));
  assert.ok(!isValidCoordinates([0, 100]));
  assert.ok(!isValidCoordinates([0]));
  assert.ok(!isValidCoordinates("here"));
});

test("a request body becomes GeoJSON, longitude first", () => {
  assert.deepEqual(toCoordinates({ latitude: 51.5072, longitude: -0.1276 }), LONDON);
  assert.equal(toCoordinates({ latitude: 51 }), null);
  assert.equal(toCoordinates({}), null);
});

test("candidates outside the range are dropped", () => {
  const candidates = [
    { pet: { _id: "near" }, coordinates: BRIGHTON },
    { pet: { _id: "far" }, coordinates: NEW_YORK },
  ];

  const within = withinRange(LONDON, candidates, 50);

  assert.equal(within.length, 1);
  assert.equal(within[0].pet._id, "near");
});

test("an unlimited range keeps everybody", () => {
  const candidates = [
    { pet: { _id: "near" }, coordinates: BRIGHTON },
    { pet: { _id: "far" }, coordinates: NEW_YORK },
  ];

  assert.equal(withinRange(LONDON, candidates, null).length, 2);
});

test("someone who has not shared a position is still shown", () => {
  const candidates = [{ pet: { _id: "unknown" }, coordinates: null }];

  // Excluding them empties the deck early on, when almost nobody has shared.
  const within = withinRange(LONDON, candidates, 10);

  assert.equal(within.length, 1);
  assert.equal(within[0].distanceMiles, null);
});

test("distance comes back on every candidate", () => {
  const within = withinRange(LONDON, [{ pet: { _id: "a" }, coordinates: BRIGHTON }], null);

  assert.ok(within[0].distanceMiles > 40);
});

test("miles are rounded to something a person would say", () => {
  assert.equal(formatMiles(2.44444), 2.4);
  assert.equal(formatMiles(null), null);
});

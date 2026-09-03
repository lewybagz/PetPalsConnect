const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WEIGHTS,
  MATCH_THRESHOLD,
  normalisePet,
  breedScore,
  temperamentScore,
  activityScore,
  sizeScore,
  ageScore,
  scorePair,
  rankMatches,
} = require("../services/matching/score");
const {
  TEMPERAMENTS,
  TEMPERAMENT_AFFINITY,
  ACTIVITY_TEMPERAMENTS,
} = require("../services/matching/compatibility");

/**
 * The scorer is pure, so these need no database - they exercise the algorithm
 * directly rather than through HTTP.
 */

const pet = (overrides = {}) => ({
  _id: "pet-id",
  name: "Rex",
  breed: "Labrador",
  temperament: "Friendly",
  weight: 60,
  age: 3,
  favoriteActivities: ["fetch", "walking"],
  ...overrides,
});

// --- Table sanity ---------------------------------------------------------

test("the weights sum to 100 so scores are a percentage", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test("temperament affinity is symmetric", () => {
  const asymmetric = [];
  for (const [temperament, partners] of Object.entries(TEMPERAMENT_AFFINITY)) {
    for (const partner of partners) {
      if (!TEMPERAMENT_AFFINITY[partner]?.includes(temperament)) {
        asymmetric.push(`${temperament} -> ${partner} is not reciprocated`);
      }
    }
  }
  assert.deepEqual(asymmetric, []);
});

test("every temperament the app offers appears in the affinity table", () => {
  // "Extravert" was spelled that way here while the app offers "Extrovert",
  // so that temperament silently matched nothing.
  const missing = TEMPERAMENTS.filter((t) => !TEMPERAMENT_AFFINITY[t]);
  assert.deepEqual(missing, []);
});

test("activity tables only reference temperaments that exist", () => {
  const unknown = new Set();
  for (const temperaments of Object.values(ACTIVITY_TEMPERAMENTS)) {
    for (const temperament of temperaments) {
      if (!TEMPERAMENTS.includes(temperament)) unknown.add(temperament);
    }
  }
  assert.deepEqual([...unknown], []);
});

// --- Normalisation --------------------------------------------------------

test("favoriteActivities is read, not the non-existent activities field", () => {
  const normalised = normalisePet({ favoriteActivities: ["fetch"], activities: ["swimming"] });
  assert.deepEqual(normalised.activities, ["fetch"]);
});

test("activities are accepted as plain strings or {value} objects", () => {
  const asObjects = normalisePet({
    favoriteActivities: [{ label: "Fetch", value: "fetch" }, { value: "hiking" }],
  });
  assert.deepEqual(asObjects.activities, ["fetch", "hiking"]);
});

test("a pet with no data at all normalises without throwing", () => {
  const normalised = normalisePet({});
  assert.equal(normalised.breed, null);
  assert.deepEqual(normalised.activities, []);
});

// --- Individual dimensions ------------------------------------------------

test("an identical breed scores higher than an affiliated one, which beats an unrelated one", () => {
  const same = breedScore(normalisePet(pet()), normalisePet(pet({ breed: "Labrador" })));
  const affiliated = breedScore(normalisePet(pet()), normalisePet(pet({ breed: "Poodle" })));
  const unrelated = breedScore(normalisePet(pet()), normalisePet(pet({ breed: "Chihuahua" })));

  assert.ok(same > affiliated, "same breed should beat an affiliated breed");
  assert.ok(affiliated > unrelated, "an affiliated breed should beat an unrelated one");
  assert.equal(unrelated, 0);
});

test("an unknown breed scores zero instead of throwing", () => {
  // Indexing the table without checking the key used to throw for any breed the
  // list did not contain - including "Mixed Breed" and "Other".
  assert.doesNotThrow(() => {
    breedScore(normalisePet(pet({ breed: "Mixed Breed" })), normalisePet(pet({ breed: "Other" })));
  });
  assert.equal(
    breedScore(normalisePet(pet({ breed: "Mixed Breed" })), normalisePet(pet({ breed: "Other" }))),
    0
  );
});

test("breed affinity counts in either direction", () => {
  const forward = breedScore(normalisePet(pet({ breed: "Labrador" })), normalisePet(pet({ breed: "Vizsla" })));
  const backward = breedScore(normalisePet(pet({ breed: "Vizsla" })), normalisePet(pet({ breed: "Labrador" })));
  assert.equal(forward, backward);
  assert.ok(forward > 0);
});

test("Extrovert - the spelling the app uses - matches properly", () => {
  const score = temperamentScore(
    normalisePet(pet({ temperament: "Extrovert" })),
    normalisePet(pet({ temperament: "Energetic" }))
  );
  assert.ok(score > 0, "Extrovert should be compatible with Energetic");
});

test("an unknown temperament scores zero instead of throwing", () => {
  assert.doesNotThrow(() => {
    temperamentScore(
      normalisePet(pet({ temperament: "Grumpy" })),
      normalisePet(pet({ temperament: "Calm" }))
    );
  });
});

test("similar sizes score higher than mismatched ones", () => {
  const similar = sizeScore(normalisePet(pet({ weight: 60 })), normalisePet(pet({ weight: 65 })));
  const mismatched = sizeScore(normalisePet(pet({ weight: 60 })), normalisePet(pet({ weight: 8 })));

  assert.ok(similar > 0.9, `expected near-identical sizes to score high, got ${similar}`);
  assert.equal(mismatched, 0, "a 60lb dog and an 8lb dog should not score on size");
});

test("size uses a ratio, so equal absolute gaps differ by scale", () => {
  // 5 vs 15 lbs is a far bigger mismatch than 80 vs 90, despite similar gaps.
  const small = sizeScore(normalisePet(pet({ weight: 5 })), normalisePet(pet({ weight: 15 })));
  const large = sizeScore(normalisePet(pet({ weight: 80 })), normalisePet(pet({ weight: 90 })));
  assert.ok(large > small);
});

test("a missing weight scores neutral rather than burying the pet", () => {
  const score = sizeScore(normalisePet(pet({ weight: null })), normalisePet(pet()));
  assert.equal(score, 0.5);
});

test("closer ages score higher, and five years apart scores zero", () => {
  const close = ageScore(normalisePet(pet({ age: 3 })), normalisePet(pet({ age: 3 })));
  const apart = ageScore(normalisePet(pet({ age: 1 })), normalisePet(pet({ age: 9 })));
  assert.equal(close, 1);
  assert.equal(apart, 0);
});

test("shared activities score, and no overlap scores zero", () => {
  const shared = activityScore(
    normalisePet(pet({ favoriteActivities: ["fetch", "walking"] })),
    normalisePet(pet({ favoriteActivities: ["fetch", "walking"] }))
  );
  const none = activityScore(
    normalisePet(pet({ favoriteActivities: ["fetch"] })),
    normalisePet(pet({ favoriteActivities: ["puzzles"] }))
  );

  assert.ok(shared > 0.9);
  assert.equal(none, 0);
});

test("listing every activity does not beat a genuinely similar pet", () => {
  const all = Object.keys(ACTIVITY_TEMPERAMENTS);
  const target = normalisePet(pet({ favoriteActivities: ["fetch", "walking"] }));

  const similar = activityScore(target, normalisePet(pet({ favoriteActivities: ["fetch", "walking"] })));
  const spammer = activityScore(target, normalisePet(pet({ favoriteActivities: all })));

  // Scoring by raw count of shared activities would let the spammer win.
  assert.ok(similar > spammer, `similar ${similar} should beat spammer ${spammer}`);
});

// --- Whole-pair scoring ---------------------------------------------------

test("an identical pet scores at or near the maximum", () => {
  const { score } = scorePair(pet(), pet({ _id: "other" }));
  assert.ok(score >= 95, `expected a near-perfect score, got ${score}`);
});

test("weight actually influences the final score", () => {
  // Before this rewrite, weight was required on every pet but never read by the
  // matcher. This is the test that keeps it wired in.
  const base = pet();
  const sameSize = scorePair(base, pet({ _id: "a", weight: 60 })).score;
  const verySmall = scorePair(base, pet({ _id: "b", weight: 6 })).score;

  assert.ok(
    sameSize > verySmall,
    `size should matter: same-size ${sameSize} vs tiny ${verySmall}`
  );
  assert.ok(sameSize - verySmall >= 10, "size should carry meaningful weight");
});

test("the breakdown explains the score and adds up to it", () => {
  const { score, breakdown } = scorePair(pet(), pet({ _id: "other" }));

  assert.deepEqual(
    Object.keys(breakdown).sort(),
    ["activities", "age", "breed", "size", "temperament"]
  );

  const summed = Object.values(breakdown).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(summed - score) <= 3, `breakdown ${summed} should track score ${score}`);
});

test("scoring never throws on missing or malformed pets", () => {
  const nasty = [{}, { breed: 42 }, { favoriteActivities: "not-an-array" }, { weight: "heavy" }];
  for (const bad of nasty) {
    assert.doesNotThrow(() => scorePair(pet(), bad), `threw on ${JSON.stringify(bad)}`);
  }
});

test("scores stay within 0-100", () => {
  const cases = [
    [pet(), pet({ _id: "x" })],
    [pet({ weight: 1, age: 0 }), pet({ _id: "y", weight: 200, age: 20, breed: "Pug", temperament: "Calm", favoriteActivities: [] })],
    [{}, {}],
  ];
  for (const [a, b] of cases) {
    const { score } = scorePair(a, b);
    assert.ok(score >= 0 && score <= 100, `score out of range: ${score}`);
  }
});

// --- Ranking --------------------------------------------------------------

test("ranking never returns the pet itself", () => {
  const self = pet({ _id: "self" });
  const ranked = rankMatches(self, [self, pet({ _id: "other" })]);
  assert.ok(ranked.every((match) => String(match.petId) !== "self"));
});

test("ranking sorts best first and drops anything under the threshold", () => {
  const target = pet({ _id: "target" });
  const ranked = rankMatches(target, [
    pet({ _id: "great" }),
    pet({ _id: "poor", breed: "Chihuahua", temperament: "Neuroticism", weight: 5, age: 14, favoriteActivities: ["puzzles"] }),
    pet({ _id: "good", breed: "Poodle", weight: 55 }),
  ]);

  assert.ok(ranked.length >= 2);
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].score >= ranked[i].score, "results are not sorted");
  }
  assert.ok(ranked.every((m) => m.score >= MATCH_THRESHOLD));
  assert.ok(!ranked.some((m) => String(m.petId) === "poor"), "a poor match survived the threshold");
});

test("ranking respects the limit", () => {
  const candidates = Array.from({ length: 30 }, (_, i) => pet({ _id: `pet-${i}` }));
  assert.equal(rankMatches(pet({ _id: "target" }), candidates, { limit: 5 }).length, 5);
});

test("ranking an empty field returns nothing rather than throwing", () => {
  assert.deepEqual(rankMatches(pet(), []), []);
});

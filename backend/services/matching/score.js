const {
  TEMPERAMENT_AFFINITY,
  ACTIVITY_TEMPERAMENTS,
  BREED_AFFINITY,
} = require("./compatibility");

/**
 * Pet-to-pet compatibility scoring.
 *
 * Pure functions over plain objects - no database, no Mongoose - so the
 * behaviour can be tested directly and the algorithm reasoned about on its own.
 *
 * The previous implementation could not run at all: it referenced the `Pet`
 * model through a `const pet` declared in its own initialiser, never imported a
 * model, read `pet.activities` (the field is `favoriteActivities`), passed two
 * structurally different maps to the same parameter, and indexed compatibility
 * tables without checking the key existed - so any unlisted breed threw.
 *
 * Scores are normalised to 0-100 so a threshold means something stable even if
 * the weights below are retuned.
 */

/**
 * How much each dimension can contribute. They sum to 100.
 *
 * Temperament and size lead deliberately: how two dogs play, and whether one
 * could hurt the other by accident, matter far more for a playdate than breed.
 */
const WEIGHTS = {
  temperament: 30,
  size: 25,
  activities: 25,
  breed: 12,
  age: 8,
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Normalises a pet into the shape the scorers expect. */
const normalisePet = (pet = {}) => ({
  id: pet._id ? String(pet._id) : null,
  breed: typeof pet.breed === "string" ? pet.breed.trim() : null,
  temperament: typeof pet.temperament === "string" ? pet.temperament.trim() : null,
  weight: Number.isFinite(Number(pet.weight)) ? Number(pet.weight) : null,
  age: Number.isFinite(Number(pet.age)) ? Number(pet.age) : null,
  // The schema field is `favoriteActivities`; `activities` was never populated.
  activities: Array.isArray(pet.favoriteActivities)
    ? pet.favoriteActivities
        // Tolerate both plain strings and the {label, value} objects the
        // add-pet form works with.
        .map((entry) => (typeof entry === "string" ? entry : entry?.value))
        .filter(Boolean)
    : [],
});

/**
 * 0-1. Same breed scores highest, a listed affinity partway, anything else zero.
 * An unknown breed is not an error - it just contributes nothing.
 */
const breedScore = (a, b) => {
  if (!a.breed || !b.breed) return 0;
  if (a.breed === b.breed) return 1;

  const affinities = BREED_AFFINITY[a.breed] ?? [];
  const reverse = BREED_AFFINITY[b.breed] ?? [];
  // Checked both ways so an asymmetric table entry still counts.
  return affinities.includes(b.breed) || reverse.includes(a.breed) ? 0.6 : 0;
};

/** 0-1. Identical temperaments score highest, listed affinities partway. */
const temperamentScore = (a, b) => {
  if (!a.temperament || !b.temperament) return 0;
  if (a.temperament === b.temperament) return 1;

  const affinities = TEMPERAMENT_AFFINITY[a.temperament] ?? [];
  const reverse = TEMPERAMENT_AFFINITY[b.temperament] ?? [];
  return affinities.includes(b.temperament) || reverse.includes(a.temperament) ? 0.7 : 0;
};

/**
 * 0-1 from the ratio of shared activities, with a bonus when a shared activity
 * also suits the other pet's temperament.
 *
 * Uses the Jaccard index (shared / combined) rather than a raw count, so a pet
 * that lists every activity does not out-score a genuinely similar one.
 */
const activityScore = (a, b) => {
  const mine = new Set(a.activities);
  const theirs = new Set(b.activities);
  if (mine.size === 0 || theirs.size === 0) return 0;

  const shared = [...mine].filter((activity) => theirs.has(activity));
  if (shared.length === 0) return 0;

  const union = new Set([...mine, ...theirs]).size;
  const overlap = shared.length / union;

  // Up to a 25% uplift when the shared activities suit both temperaments.
  const suitsBoth = shared.filter((activity) => {
    const temperaments = ACTIVITY_TEMPERAMENTS[activity] ?? [];
    return (
      temperaments.includes(a.temperament) && temperaments.includes(b.temperament)
    );
  }).length;

  const uplift = shared.length > 0 ? (suitsBoth / shared.length) * 0.25 : 0;
  return clamp01(overlap + overlap * uplift);
};

/**
 * 0-1 on size similarity, using the ratio of the lighter to the heavier pet.
 *
 * A ratio is the right shape here: 5lb vs 15lb is a far bigger mismatch than
 * 80lb vs 90lb, even though both differ by roughly the same amount in one case
 * and more in the other. Weight is required on every pet, so a missing value
 * means legacy data rather than a normal case; it scores neutral rather than
 * zero so old records are not buried.
 */
const sizeScore = (a, b) => {
  if (!a.weight || !b.weight || a.weight <= 0 || b.weight <= 0) return 0.5;

  const ratio = Math.min(a.weight, b.weight) / Math.max(a.weight, b.weight);

  // Within 15% of each other counts as the same size - a 60lb and a 65lb dog
  // play together fine. Below that it ramps down, reaching zero at a third
  // (e.g. 15lb vs 45lb), where size difference becomes a safety question.
  const SAME_SIZE = 0.85;
  const FLOOR = 1 / 3;

  if (ratio >= SAME_SIZE) return 1;
  return clamp01((ratio - FLOOR) / (SAME_SIZE - FLOOR));
};

/** 0-1 on closeness in age. Five years apart or more scores zero. */
const ageScore = (a, b) => {
  if (a.age === null || b.age === null) return 0.5;
  return clamp01(1 - Math.abs(a.age - b.age) / 5);
};

/**
 * Scores one pair, 0-100, with the per-dimension breakdown.
 *
 * The breakdown is returned so the app can explain *why* two pets matched,
 * which is far more useful than a bare number.
 */
const scorePair = (petA, petB) => {
  const a = normalisePet(petA);
  const b = normalisePet(petB);

  const parts = {
    temperament: temperamentScore(a, b),
    size: sizeScore(a, b),
    activities: activityScore(a, b),
    breed: breedScore(a, b),
    age: ageScore(a, b),
  };

  const total = Object.entries(parts).reduce(
    (sum, [dimension, value]) => sum + value * WEIGHTS[dimension],
    0
  );

  return {
    score: Math.round(total),
    breakdown: Object.fromEntries(
      Object.entries(parts).map(([dimension, value]) => [
        dimension,
        Math.round(value * WEIGHTS[dimension]),
      ])
    ),
  };
};

/** Below this a pair is not worth surfacing. */
const MATCH_THRESHOLD = 45;

/**
 * Ranks candidates against one pet, best first.
 * Never returns the pet itself, and never throws on odd data.
 */
const rankMatches = (pet, candidates, { threshold = MATCH_THRESHOLD, limit = 50 } = {}) => {
  const selfId = pet?._id ? String(pet._id) : null;

  return candidates
    .filter((candidate) => !selfId || String(candidate?._id) !== selfId)
    .map((candidate) => ({
      pet: candidate,
      petId: candidate?._id ?? null,
      ...scorePair(pet, candidate),
    }))
    .filter((match) => match.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
};

module.exports = {
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
};

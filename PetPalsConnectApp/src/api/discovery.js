import api from "./axios";

/**
 * Discovery: browsing candidate pets and saying yes or no.
 *
 * The matching engine has always ranked pets and written PetMatch rows, but
 * nothing in the app ever asked for them - there was no browse screen, no tab,
 * and no way to express interest. This is the client half of that loop.
 */

/**
 * The next candidates for one of your pets.
 * Omit `petId` to browse as your first pet.
 */
export const fetchCandidates = async (petId) => {
  const { data } = await api.get("/api/petmatches/discover", {
    params: petId ? { petId } : undefined,
  });

  return {
    pet: data?.pet ?? null,
    candidates: Array.isArray(data?.candidates) ? data.candidates : [],
    threshold: data?.threshold ?? 0,
    // How far the server was willing to look, in miles - null means it did not
    // limit at all. The empty state needs this to say something useful.
    range: typeof data?.range === "number" ? data.range : null,
    locationKnown: Boolean(data?.locationKnown),
  };
};

/**
 * How far away a candidate is, in words.
 *
 * Null means nobody knows: either they have not shared a position or we have
 * not. Saying "0 miles away" there would be a lie, and a strange one.
 */
export const describeDistance = (miles) => {
  if (miles == null) return null;
  if (miles < 1) return "Less than a mile away";
  if (miles < 1.5) return "About a mile away";
  return `${Math.round(miles)} miles away`;
};

/**
 * Records a like or a pass. Resolves with `{ mutual, matchedPet }` - `mutual`
 * is true when the other pet had already liked yours.
 */
export const decide = async ({ fromPetId, toPetId, decision }) => {
  const { data } = await api.post("/api/petmatches/decide", {
    fromPetId,
    toPetId,
    decision,
  });
  return data;
};

/** Your existing matches, best fit first. */
export const fetchMatches = async () => {
  const { data } = await api.get("/api/petmatches/matched-pets");
  return Array.isArray(data) ? data : [];
};

/** A short reason a candidate scored the way it did, for the card. */
export const describeScore = (score, threshold) => {
  if (score >= 80) return "Great match";
  if (score >= threshold) return "Good match";
  return "Worth a look";
};

/**
 * The weights `services/matching/score.js` gives each dimension.
 *
 * The server's breakdown is in *weighted points* (a perfect temperament match
 * contributes 30, a perfect age match 8), not a 0-1 ratio, so a fixed
 * threshold would treat "perfect on age" as weaker than "mediocre on
 * temperament". Dividing by the weight puts them back on the same scale.
 *
 * `backend/test/types.test.js` checks these against the real weights.
 */
export const MATCH_WEIGHTS = {
  temperament: 30,
  size: 25,
  activities: 25,
  breed: 12,
  age: 8,
};

const REASON_LABELS = {
  temperament: "Similar temperament",
  size: "Similar size",
  activities: "Likes the same things",
  breed: "Compatible breeds",
  age: "Close in age",
};

/**
 * The parts of a score that stand out, best first. Two concrete reasons beat
 * a bare number - "Similar size, likes the same things" is something an owner
 * can agree or disagree with.
 */
export const topReasons = (breakdown, limit = 2) =>
  Object.entries(breakdown ?? {})
    .filter(
      ([key, value]) =>
        REASON_LABELS[key] &&
        typeof value === "number" &&
        value / MATCH_WEIGHTS[key] >= 0.6
    )
    .sort(([keyA, a], [keyB, b]) => b / MATCH_WEIGHTS[keyB] - a / MATCH_WEIGHTS[keyA])
    .slice(0, limit)
    .map(([key]) => REASON_LABELS[key]);

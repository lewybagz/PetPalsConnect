import api from "./axios";

/**
 * Weight history, from the app's side.
 *
 * Storage is pounds and `src/utils/units.ts` is the only thing that converts,
 * so nothing here does arithmetic on a unit. What this module owns is the
 * published body condition scale and the shape of a trend - both descriptive,
 * neither a recommendation.
 */

/**
 * The 1-9 body condition scale as AAHA and WSAVA publish it, condensed to the
 * five points an owner can actually tell apart by hand.
 *
 * These are descriptions of what a body looks and feels like, taken from the
 * published charts. There is deliberately no "aim for this" and no target
 * weight anywhere: 37% of dogs are above their ideal weight and only 29% have
 * ever been scored by a vet, and the useful thing is that an owner can see the
 * scale at all - the conclusion is the vet's.
 */
export const BODY_CONDITION = [
  {
    score: 1,
    label: "Very thin",
    body: "Ribs, spine and hip bones are visible from a distance. No fat can be felt.",
  },
  {
    score: 3,
    label: "Thin",
    body: "Ribs are easily felt and may be visible. The waist is obvious from above.",
  },
  {
    score: 5,
    label: "Ideal",
    body: "Ribs can be felt without pressing. There is a waist behind the ribs from above, and the belly tucks up from the side.",
  },
  {
    score: 7,
    label: "Overweight",
    body: "Ribs are hard to feel under a layer of fat. The waist is hard to see and the belly barely tucks up.",
  },
  {
    score: 9,
    label: "Obese",
    body: "Ribs cannot be felt. Fat is obvious over the spine and tail base, and the belly hangs.",
  },
];

export const BODY_CONDITION_SOURCE = {
  name: "AAHA and WSAVA body condition guidelines",
  url: "https://wsava.org/global-guidelines/global-nutrition-guidelines/",
};

/** The series for one pet, newest first, plus whether this species is weighed. */
export const fetchWeights = async (petId) => {
  const { data } = await api.get(`/api/pets/${petId}/weight`);
  return {
    measured: Boolean(data?.measured),
    entries: Array.isArray(data?.entries) ? data.entries : [],
  };
};

export const addWeight = async (petId, { pounds, takenAt, bodyCondition, notes } = {}) => {
  const { data } = await api.post(`/api/pets/${petId}/weight`, {
    pounds,
    takenAt,
    bodyCondition: bodyCondition || undefined,
    notes: notes || undefined,
  });
  return data?.entry ?? null;
};

export const removeWeight = async (petId, entryId) => {
  const { data } = await api.delete(`/api/pets/${petId}/weight/${entryId}`);
  return Boolean(data?.removed);
};

/**
 * The direction of travel between the oldest and newest entry in hand.
 *
 * Describes what the numbers did and stops there: "up 2.4 lb since March", not
 * "your dog is overweight". Null with fewer than two entries, because one
 * point is not a trend and inventing one would be the same sin as guessing a
 * life stage from an unknown age.
 */
export const describeTrend = (entries = []) => {
  if (entries.length < 2) return null;

  // The series arrives newest first.
  const newest = entries[0];
  const oldest = entries[entries.length - 1];
  const change = Number(newest.pounds) - Number(oldest.pounds);

  if (!Number.isFinite(change)) return null;

  return {
    change,
    // A tenth of a pound either way is a scale, not a change.
    direction: Math.abs(change) < 0.1 ? "steady" : change > 0 ? "up" : "down",
    from: oldest.takenAt,
    to: newest.takenAt,
  };
};

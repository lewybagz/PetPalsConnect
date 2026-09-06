/**
 * Reading distances and weights in whichever units somebody prefers.
 *
 * Storage is canonical - miles and pounds - and stays that way. Matching
 * compares numbers, so a stored unit would mean converting before every
 * comparison and would make two pets' weights incomparable if their owners had
 * chosen differently. The preference is a display concern and lives only here
 * and in the components that render.
 *
 * Onboarding already asks for a weight in either unit and converts to pounds
 * before saving, so the input half of this was done; what was missing was
 * reading it back in the same units it was typed in.
 */

export type DistanceUnit = "mi" | "km";
export type WeightUnit = "lb" | "kg";

export type Units = {
  distance: DistanceUnit;
  weight: WeightUnit;
};

export const DEFAULT_UNITS: Units = { distance: "mi", weight: "lb" };

const KM_PER_MILE = 1.609344;
const KG_PER_POUND = 0.45359237;

export const milesToKm = (miles: number): number => miles * KM_PER_MILE;
export const kmToMiles = (km: number): number => km / KM_PER_MILE;
export const poundsToKg = (pounds: number): number => pounds * KG_PER_POUND;
export const kgToPounds = (kg: number): number => kg / KG_PER_POUND;

/**
 * Rounds for reading rather than for accuracy.
 *
 * Under ten, one decimal - the difference between 2.4 and 2.9 miles is worth
 * knowing when you are deciding whether to walk. Above ten it is noise, and
 * "23 miles" reads better than "23.4 miles".
 */
const readable = (value: number): string =>
  value < 10 ? String(Math.round(value * 10) / 10) : String(Math.round(value));

/**
 * A distance, in the caller's units.
 *
 * `null` is "we do not know", which is a real state: somebody who has never
 * shared a position has no distance, and they stay in the deck rather than
 * being dropped from it.
 */
export const formatDistance = (
  miles: number | null | undefined,
  units: Units = DEFAULT_UNITS
): string | null => {
  if (miles === null || miles === undefined || !Number.isFinite(miles)) return null;

  return units.distance === "km"
    ? `${readable(milesToKm(miles))} km`
    : `${readable(miles)} mi`;
};

/** A weight, in the caller's units. Stored in pounds whatever this says. */
export const formatWeight = (
  pounds: number | null | undefined,
  units: Units = DEFAULT_UNITS
): string | null => {
  if (pounds === null || pounds === undefined || !Number.isFinite(pounds)) return null;

  return units.weight === "kg"
    ? `${readable(poundsToKg(pounds))} kg`
    : `${readable(pounds)} lb`;
};

/** Converts a number the user typed in their own units into pounds, to store. */
export const weightToPounds = (value: number, unit: WeightUnit): number =>
  unit === "kg" ? kgToPounds(value) : value;

/** The stored pounds as a number in the user's units, for prefilling an input. */
export const weightFromPounds = (pounds: number, unit: WeightUnit): number =>
  unit === "kg" ? poundsToKg(pounds) : pounds;

/** Distance the same way round, for a slider whose stored value is miles. */
export const distanceToMiles = (value: number, unit: DistanceUnit): number =>
  unit === "km" ? kmToMiles(value) : value;

export const distanceFromMiles = (miles: number, unit: DistanceUnit): number =>
  unit === "km" ? milesToKm(miles) : miles;

/** Short labels, for a slider's ends and a picker's options. */
export const distanceLabel = (units: Units = DEFAULT_UNITS): string =>
  units.distance === "km" ? "km" : "miles";

export const weightLabel = (units: Units = DEFAULT_UNITS): string =>
  units.weight === "kg" ? "kg" : "lb";

export default {
  DEFAULT_UNITS,
  formatDistance,
  formatWeight,
  weightToPounds,
  weightFromPounds,
  distanceToMiles,
  distanceFromMiles,
  distanceLabel,
  weightLabel,
};

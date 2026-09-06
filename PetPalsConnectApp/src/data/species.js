import { BREEDS } from "./breeds";

/**
 * The kinds of animal a profile can hold, and what the form should ask about
 * each one.
 *
 * Playdates are dogs only - two dogs meeting in a park is the premise, and the
 * server's deck filters to `dog`. Every other species is here because an
 * owner's other pets are still pets: the care hub recommends food, supplies
 * and a nearby vet from them, and an owner who cannot list their cat gets
 * nothing out of it.
 *
 * `breeds`, `weighed` and `matchable` are the three things that actually
 * differ, and they are declared here rather than branched on at each field:
 * asking a fish keeper for a breed and a weight in pounds is how a form
 * teaches somebody that the app was not built for them. `species` values match
 * the `SPECIES` enum on the Pet schema exactly.
 */

/**
 * Cat breeds, deliberately short and ending in "Other".
 *
 * Most cats are not pedigree, so the list a cat owner needs is a handful of
 * recognisable breeds plus the two domestic shorthair/longhair answers that
 * cover almost everybody - not the 70-entry registry list that would make
 * "Domestic Shorthair" hard to find.
 */
export const CAT_BREEDS = [
  "Domestic Shorthair",
  "Domestic Longhair",
  "Abyssinian",
  "American Shorthair",
  "Bengal",
  "British Shorthair",
  "Burmese",
  "Devon Rex",
  "Maine Coon",
  "Norwegian Forest Cat",
  "Persian",
  "Ragdoll",
  "Russian Blue",
  "Scottish Fold",
  "Siamese",
  "Siberian",
  "Sphynx",
  "Tabby",
  "Tuxedo",
  "Other",
];

export const SPECIES = [
  {
    value: "dog",
    label: "Dog",
    shortLabel: "Dog",
    /** The only species playdates are for. */
    matchable: true,
    breeds: BREEDS,
    weighed: true,
  },
  {
    value: "cat",
    label: "Cat",
    shortLabel: "Cat",
    matchable: false,
    breeds: CAT_BREEDS,
    weighed: true,
  },
  {
    value: "smallMammal",
    // The long label is what a picker needs - somebody looking for "rabbit"
    // has to find this row. The short one is what a finished profile shows.
    label: "Small pet (rabbit, guinea pig, hamster…)",
    shortLabel: "Small pet",
    matchable: false,
    breeds: null,
    weighed: false,
  },
  {
    value: "bird",
    label: "Bird",
    shortLabel: "Bird",
    matchable: false,
    breeds: null,
    weighed: false,
  },
  {
    value: "reptile",
    label: "Reptile",
    shortLabel: "Reptile",
    matchable: false,
    breeds: null,
    weighed: false,
  },
  {
    value: "fish",
    label: "Fish",
    shortLabel: "Fish",
    matchable: false,
    breeds: null,
    weighed: false,
  },
];

/** The species a new pet is assumed to be, and the one the app is built around. */
export const DEFAULT_SPECIES = "dog";

const BY_VALUE = new Map(SPECIES.map((entry) => [entry.value, entry]));

/**
 * The rules for one species.
 *
 * Falls back to dog rather than returning undefined: an unknown value can only
 * come from a pet stored before `species` existed, and those are all dogs.
 */
export const speciesInfo = (value) =>
  BY_VALUE.get(value) ?? BY_VALUE.get(DEFAULT_SPECIES);

/** Whether this species can take part in matching and playdates. */
export const isMatchable = (value) => speciesInfo(value).matchable;

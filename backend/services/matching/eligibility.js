/**
 * Which pets can be matched at all.
 *
 * Profiles hold any species - a cat, a rabbit, a bearded dragon - because the
 * care hub recommends food, supplies and a vet from them. Playdates do not:
 * two dogs meeting in a park is the premise, `compatibility.js` scores size,
 * temperament and activity in dog terms, and putting a goldfish in the deck
 * would be a bug with a very confused user at the end of it.
 *
 * The rule lives here rather than inline in a query because there are two
 * candidate queries - `runMatching` scores a new pet against the field,
 * `reachableCandidates` builds the deck - and a rule written twice is a rule
 * one of them will eventually be missing. That is the same reasoning that put
 * blocking and suspension inside `reachableCandidates` in the first place.
 */

/** The one species playdates are for. */
const MATCHABLE_SPECIES = "dog";

/**
 * The query fragment selecting matchable pets.
 *
 * `$in: [..., null]` rather than a plain equality, because `species` was added
 * to `Pet` after rows already existed and those rows have no `species` key at
 * all - `{ species: "dog" }` does not match a document that lacks the field, so
 * a plain equality would have emptied the deck for every pet created before
 * this change. In MongoDB `null` inside `$in` matches missing fields as well as
 * explicit nulls, and unlike `$exists: false` it still uses the index on
 * `species`. The schema default backfills anything written since.
 */
const matchableQuery = () => ({
  species: { $in: [MATCHABLE_SPECIES, null] },
});

/**
 * Whether one pet can take part in matching.
 *
 * Same tolerance for the same reason: a pet stored before `species` existed is
 * a dog, because at the time there was nothing else it could be.
 */
const isMatchable = (pet) =>
  !pet?.species || pet.species === MATCHABLE_SPECIES;

module.exports = { MATCHABLE_SPECIES, matchableQuery, isMatchable };

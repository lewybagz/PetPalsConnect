const {
  LIFE_STAGES,
  STAGE_BOUNDARIES,
  SIZE_BANDS,
  CATEGORIES,
  PICKS,
} = require("./picks");

/**
 * Turning a pet into a list of things worth buying for it.
 *
 * Pure functions over the table in `picks.js`, so the rules can be tested
 * without a database and the table can be edited without touching the rules.
 *
 * Everything here works from two facts: how old the pet is and how big it is.
 * Those are shopping facts, and shopping is all this does.
 */

/**
 * Which stage of life a pet is in.
 *
 * Boundaries differ by species and are approximate - the app knows an age in
 * whole years and nothing more, and pretending to more precision than that
 * would be inventing it. An unknown age returns null rather than guessing
 * "adult": a pick shown for the wrong stage is worse than one not shown, and
 * `recommend` treats null as "show the picks that do not depend on stage".
 */
const lifeStage = (species, age) => {
  const boundaries = STAGE_BOUNDARIES[species];
  if (!boundaries) return null;
  if (age == null || !Number.isFinite(Number(age)) || Number(age) < 0) return null;

  const years = Number(age);
  if (years < boundaries.adultFrom) return "young";
  if (years < boundaries.seniorFrom) return "adult";
  return "senior";
};

/**
 * Which size band a pet falls in, for the species that record a weight.
 *
 * Only dogs and cats do - the schema requires `weight` for those two and for
 * nothing else - so every other species returns null and simply never sees a
 * size-dependent pick.
 */
const sizeBand = (species, weight) => {
  const bands = SIZE_BANDS[species];
  if (!bands) return null;
  if (weight == null || !Number.isFinite(Number(weight)) || Number(weight) <= 0) {
    return null;
  }

  const pounds = Number(weight);
  return bands.find((band) => pounds <= band.upToPounds)?.size ?? null;
};

/**
 * Whether a pick applies to a pet.
 *
 * A pick with no `stages` applies at every stage, and one with no `sizes`
 * applies at every size - most do, and listing every value would make the
 * table harder to read and easier to get wrong. When the pet's stage or size
 * is unknown, a pick that depends on it is left out rather than guessed at.
 */
const applies = (pick, { species, stage, size }) => {
  if (pick.species !== species) return false;
  if (pick.stages && (!stage || !pick.stages.includes(stage))) return false;
  if (pick.sizes && (!size || !pick.sizes.includes(size))) return false;
  return true;
};

/**
 * Whether this pet's notes are something to take to a vet.
 *
 * `specialNeeds` is free text an owner typed - "diabetic", "three legs",
 * "recovering from surgery", "hates men in hats". None of it is a shopping
 * problem, and an app that read it and returned a link to a bag of food would
 * be answering a medical question it has no business answering. So it is never
 * an input to a pick; its only effect is this flag, which the hub uses to put
 * the local vets in front of somebody instead.
 *
 * Deliberately not keyword-matched against a list of conditions. Trying to
 * decide which notes are "medical enough" would mean getting it wrong in the
 * direction that matters - and an owner who wrote anything in this field is
 * someone for whom "here is your nearest vet" is a reasonable thing to show.
 */
const needsVetAttention = (pet) =>
  typeof pet?.specialNeeds === "string" && pet.specialNeeds.trim().length > 0;

/**
 * The picks for one pet, grouped into the hub's shelves.
 *
 * Returns the pet's derived facts alongside the picks so the screen can say
 * *why* it is showing what it is showing - "for an adult, medium dog" - which
 * is the difference between a recommendation and an advert.
 */
const forPet = (pet) => {
  // A pet stored before `species` existed is a dog; there was nothing else it
  // could have been at the time.
  const species = pet?.species ?? "dog";
  const stage = lifeStage(species, pet?.age);
  const size = sizeBand(species, pet?.weight);

  const matched = PICKS.filter((pick) => applies(pick, { species, stage, size }));

  return {
    petId: pet?._id ?? null,
    name: pet?.name ?? null,
    species,
    stage,
    size,
    // The hub shows the vet shelf instead of guessing at a health product.
    seeAVet: needsVetAttention(pet),
    shelves: CATEGORIES.map((category) => ({
      category,
      // The filter fields are stripped: they are how a pick was chosen, not
      // anything the screen renders, and sending them invites a client to
      // start doing the choosing itself.
      picks: matched
        .filter((pick) => pick.category === category)
        .map(({ species: _species, stages: _stages, sizes: _sizes, ...pick }) => pick),
    })).filter((shelf) => shelf.picks.length > 0),
  };
};

/** Every pet the caller owns, each with its own picks. */
const forPets = (pets = []) => pets.map(forPet);

module.exports = {
  LIFE_STAGES,
  CATEGORIES,
  lifeStage,
  sizeBand,
  applies,
  needsVetAttention,
  forPet,
  forPets,
};

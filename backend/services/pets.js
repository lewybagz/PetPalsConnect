const Pet = require("../models/Pet");
const User = require("../models/User");
const { sanitisePhotos } = require("./photos");

/**
 * Creating and editing a pet, in one place.
 *
 * Lifted from `PetController` so Spot writes through the same path as the
 * add-a-pet screen: ownership from the caller, the link onto `user.pets`
 * (which the onboarding gate reads), photos sanitised, matching run
 * best-effort. `EDITABLE` is the one allowlist of what an owner may change;
 * `owner`, `creator` and `species` are not on it.
 */

const EDITABLE = [
  "name",
  "breed",
  "age",
  "weight",
  "photos",
  "specialNeeds",
  "temperament",
  "activityLevel",
  "socialisation",
  "favoriteActivities",
  "location",
];

const fail = (status, message) => Object.assign(new Error(message), { status });

/** Creates a pet for `ownerId` and links it. Returns `{ pet, matches }`. */
const create = async ({ ownerId, fields = {} }) => {
  const {
    name, species, breed, age, weight, photos, specialNeeds, temperament,
    activityLevel, socialisation, favoriteActivities, location,
  } = fields;

  const pet = await Pet.create({
    name,
    // Left undefined when absent so the schema default ("dog") applies.
    ...(species ? { species } : {}),
    breed,
    age,
    weight,
    photos: sanitisePhotos(photos),
    specialNeeds,
    temperament,
    activityLevel,
    socialisation,
    favoriteActivities: favoriteActivities ?? [],
    location,
    owner: ownerId,
    creator: ownerId,
  });

  // $addToSet keeps this safe to retry.
  await User.updateOne({ _id: ownerId }, { $addToSet: { pets: pet._id } });

  // Matching is best-effort: a pet that saved must not fail because the
  // matcher had a problem. Required here rather than at the top because both
  // are controllers and one of them requires this file's caller.
  let matches = [];
  try {
    const { checkSubscriptionStatus } = require("../controllers/SubscriptionController");
    const { runMatching } = require("../controllers/PetMatchController");
    const isSubscribed = await checkSubscriptionStatus(ownerId);
    matches = await runMatching(pet._id, { isSubscribed });
  } catch (error) {
    console.warn("[pets] Matching failed for new pet:", error.message);
  }

  // Two days from now, ask for the fields the short onboarding form defers -
  // temperament, activity level, socialisation - if they are still empty.
  // Best-effort like the matching above: a scheduler write must never fail
  // the pet creation that caused it.
  try {
    await require("./petProfileNudge").scheduleNudge(pet);
  } catch (error) {
    console.warn("[pets] Could not queue the profile nudge:", error.message);
  }

  return { pet, matches };
};

/**
 * Applies the editable fields present in `fields` to the caller's own pet.
 * Returns `{ pet, previous }`, where `previous` holds the old value of every
 * field that changed - which is what an undo needs.
 */
const update = async ({ ownerId, petId, fields = {} }) => {
  const pet = await Pet.findById(petId);
  if (!pet) throw fail(404, "Cannot find pet");
  if (String(pet.owner) !== String(ownerId)) throw fail(403, "That isn't your pet");

  const previous = {};
  for (const field of EDITABLE) {
    if (fields[field] === undefined) continue;
    previous[field] = pet[field] === undefined ? null : JSON.parse(JSON.stringify(pet[field]));
    pet[field] = field === "photos" ? sanitisePhotos(fields[field]) : fields[field];
  }
  pet.modifiedDate = new Date();
  await pet.save();
  return { pet, previous };
};

module.exports = { EDITABLE, create, update };

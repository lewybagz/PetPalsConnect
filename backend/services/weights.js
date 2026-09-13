const WeightEntry = require("../models/WeightEntry");
const Pet = require("../models/Pet");

/**
 * The one writer of a pet's weight.
 *
 * `Pet.weight` is what size compatibility scores on and the newest
 * `WeightEntry` is the history's answer to the same question. Two writers of
 * that pair is the bug shape this codebase has already fixed twice, so the
 * rule "the newest entry *is* `Pet.weight`" is written here once and the
 * weight endpoint and Spot's `log_weight` tool both call it. Lifted out of
 * `WeightController` for exactly that second caller.
 *
 * Errors carry a `status` the way `services/settings.js` and `places.js`
 * throw them; the controller answers with it.
 */

/** Only the species the schema stores a weight for; a fish has no history. */
const MEASURED_SPECIES = ["dog", "cat"];

const fail = (status, message, extra) =>
  Object.assign(new Error(message), { status, ...extra });

/**
 * The owner's own pet, or a 404/403 the caller can answer with.
 *
 * Ownership is checked here rather than in each caller so that a pet id the
 * model or a client supplies is only ever resolved through `owner`.
 */
const ownPet = async (ownerId, petId, select = "owner name species") => {
  const pet = await Pet.findById(petId).select(select).lean();
  if (!pet) throw fail(404, "Cannot find pet");
  if (String(pet.owner) !== String(ownerId)) throw fail(403, "That isn't your pet");
  return pet;
};

const newestFor = (petId, ownerId) =>
  WeightEntry.findOne({ pet: petId, owner: ownerId })
    .sort({ takenAt: -1 })
    .select("pounds")
    .lean();

/**
 * Records a weigh-in and moves `Pet.weight` only when the new row really is
 * the most recent: back-filling last year's number must not overwrite what
 * the pet weighs now.
 */
const logWeight = async ({ ownerId, petId, pounds, takenAt, bodyCondition, notes }) => {
  const pet = await ownPet(ownerId, petId);
  if (!MEASURED_SPECIES.includes(pet.species ?? "dog")) {
    throw fail(400, "Weight is only tracked for dogs and cats", { field: "species" });
  }

  const created = await WeightEntry.create({
    pet: pet._id,
    owner: ownerId,
    creator: ownerId,
    pounds,
    takenAt: takenAt || new Date(),
    bodyCondition: bodyCondition || undefined,
    notes,
  });

  const newest = await newestFor(pet._id, ownerId);
  if (newest && String(newest._id) === String(created._id)) {
    await Pet.findByIdAndUpdate(pet._id, { weight: created.pounds });
  }

  return created;
};

/**
 * Removes one weigh-in; scoped on the owner so somebody else's id finds
 * nothing. The current weight then follows the newest remaining entry - a
 * number the owner has just said was wrong must not stay on the pet.
 */
const removeWeight = async ({ ownerId, petId, entryId }) => {
  const deleted = await WeightEntry.findOneAndDelete({ _id: entryId, pet: petId, owner: ownerId });
  if (!deleted) throw fail(404, "Cannot find that entry");

  const newest = await newestFor(petId, ownerId);
  if (newest) await Pet.findByIdAndUpdate(petId, { weight: newest.pounds });

  return deleted;
};

module.exports = { MEASURED_SPECIES, ownPet, logWeight, removeWeight };

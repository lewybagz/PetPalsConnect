const WeightEntry = require("../models/WeightEntry");
const Pet = require("../models/Pet");

/**
 * Weight history for one pet.
 *
 * It records what the scales said and shows the trend beside the published
 * body condition scale. It never names a target weight, a calorie figure or a
 * diet: the same rule as the rest of the app's health surface - describe what
 * published guidance says, never prescribe. 37% of dog owners report a pet
 * above its ideal weight and only 29% have had a body condition score from a
 * vet (APOP 2025), so the useful thing here is the number over time and the
 * chart to read it against, not an opinion.
 *
 * Only the species the schema stores a weight for. `Pet.weight` is required
 * for dogs and cats and meaningless for a fish, and a history of a number that
 * was never collected is not a feature.
 */
const MEASURED_SPECIES = ["dog", "cat"];

/** The caller's own pet, or the response that says why not. */
const ownPet = async (req, res) => {
  const pet = await Pet.findById(req.params.petId).select("owner name species").lean();
  if (!pet) {
    res.status(404).json({ message: "Cannot find pet" });
    return null;
  }
  if (String(pet.owner) !== String(req.userId)) {
    res.status(403).json({ message: "That isn't your pet" });
    return null;
  }
  return pet;
};

const WeightController = {
  /**
   * The series, newest first, with the scale the app renders it against.
   *
   * The scale travels with the data so the screen does not carry its own copy
   * of a clinical chart - the same reasoning as the notification screen
   * fetching its categories rather than listing them.
   */
  async listEntries(req, res) {
    try {
      const pet = await ownPet(req, res);
      if (!pet) return;

      const entries = await WeightEntry.find({ pet: pet._id, owner: req.userId })
        .sort({ takenAt: -1 })
        .lean();

      res.json({
        measured: MEASURED_SPECIES.includes(pet.species ?? "dog"),
        entries,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Records a weigh-in, and moves `Pet.weight` to match.
   *
   * The second half matters: `Pet.weight` is what size compatibility scores
   * on, and leaving it behind would make the app hold two answers to "how
   * heavy is this dog" - the exact shape of bug this codebase has already
   * fixed twice. The newest entry is the current weight, by definition.
   */
  async createEntry(req, res) {
    try {
      const pet = await ownPet(req, res);
      if (!pet) return;

      if (!MEASURED_SPECIES.includes(pet.species ?? "dog")) {
        return res.status(400).json({
          message: "Weight is only tracked for dogs and cats",
          field: "species",
        });
      }

      const { pounds, takenAt, bodyCondition, notes } = req.body;

      const created = await WeightEntry.create({
        pet: pet._id,
        owner: req.userId,
        creator: req.userId,
        pounds,
        takenAt: takenAt || new Date(),
        bodyCondition: bodyCondition || undefined,
        notes,
      });

      // Only when this really is the most recent weigh-in: back-filling last
      // year's number must not overwrite what the pet weighs now.
      const newest = await WeightEntry.findOne({ pet: pet._id, owner: req.userId })
        .sort({ takenAt: -1 })
        .select("pounds")
        .lean();

      if (newest && String(newest._id) === String(created._id)) {
        await Pet.findByIdAndUpdate(pet._id, { weight: created.pounds });
      }

      res.status(201).json({ entry: created });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  },

  /** Removes one. Scoped on the caller, so somebody else's id finds nothing. */
  async deleteEntry(req, res) {
    try {
      const deleted = await WeightEntry.findOneAndDelete({
        _id: req.params.entryId,
        pet: req.params.petId,
        owner: req.userId,
      });
      if (!deleted) {
        return res.status(404).json({ message: "Cannot find that entry" });
      }

      // The current weight follows the newest remaining entry. Deleting the
      // most recent weigh-in must not leave `Pet.weight` quoting a number the
      // owner has just said was wrong.
      const newest = await WeightEntry.findOne({
        pet: req.params.petId,
        owner: req.userId,
      })
        .sort({ takenAt: -1 })
        .select("pounds")
        .lean();

      if (newest) {
        await Pet.findByIdAndUpdate(req.params.petId, { weight: newest.pounds });
      }

      res.json({ removed: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = WeightController;
module.exports.MEASURED_SPECIES = MEASURED_SPECIES;

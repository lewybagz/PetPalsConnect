const WeightEntry = require("../models/WeightEntry");
const weights = require("../services/weights");

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
 * The writes live in `services/weights.js` because Spot writes weights too;
 * this controller only reads and answers.
 */

/** A service error carries its status; anything else is a 500. */
const answer = (res, err) => {
  if (err.status) {
    return res.status(err.status).json({ message: err.message, ...(err.field && { field: err.field }) });
  }
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  res.status(500).json({ message: err.message });
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
      const pet = await weights.ownPet(req.userId, req.params.petId);

      const entries = await WeightEntry.find({ pet: pet._id, owner: req.userId })
        .sort({ takenAt: -1 })
        .lean();

      res.json({
        measured: weights.MEASURED_SPECIES.includes(pet.species ?? "dog"),
        entries,
      });
    } catch (err) {
      answer(res, err);
    }
  },

  /** Records a weigh-in; `services/weights` moves `Pet.weight` to match. */
  async createEntry(req, res) {
    try {
      const { pounds, takenAt, bodyCondition, notes } = req.body;
      const entry = await weights.logWeight({
        ownerId: req.userId,
        petId: req.params.petId,
        pounds,
        takenAt,
        bodyCondition,
        notes,
      });
      res.status(201).json({ entry });
    } catch (err) {
      answer(res, err);
    }
  },

  async deleteEntry(req, res) {
    try {
      await weights.removeWeight({
        ownerId: req.userId,
        petId: req.params.petId,
        entryId: req.params.entryId,
      });
      res.json({ removed: true });
    } catch (err) {
      answer(res, err);
    }
  },
};

module.exports = WeightController;
module.exports.MEASURED_SPECIES = weights.MEASURED_SPECIES;

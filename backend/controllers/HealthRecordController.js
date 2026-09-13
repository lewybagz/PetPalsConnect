const HealthRecord = require("../models/HealthRecord");
const Pet = require("../models/Pet");
const vaccinations = require("../services/vaccinations");
const healthRecords = require("../services/healthRecords");
const { ownPet } = require("../services/weights");

/**
 * Health records, from the API's side.
 *
 * The writes - and the reminder they queue, and the "a vaccine has no cycle"
 * rule - live in `services/healthRecords.js`, because Spot writes records
 * too. This controller reads, answers, and hands writes over.
 */

/** A service error carries its status; anything else is a 500. */
const answer = (res, err) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  res.status(500).json({ message: err.message });
};

const HealthRecordController = {
  /** Everything recorded for one of the caller's pets, newest first, with the status. */
  async listRecords(req, res) {
    try {
      const pet = await ownPet(req.userId, req.params.petId, "owner name");

      const records = await HealthRecord.find({ pet: pet._id, owner: req.userId })
        .sort({ administeredAt: -1 })
        .lean();

      res.json({
        status: vaccinations.statusOf(records),
        kinds: vaccinations.KINDS,
        coreKinds: vaccinations.CORE_KINDS,
        categories: vaccinations.KIND_CATEGORIES,
        records,
      });
    } catch (err) {
      answer(res, err);
    }
  },

  async createRecord(req, res) {
    try {
      const { kind, administeredAt, expiresAt, certificatePhoto, notes, intervalDays, label } =
        req.body;
      const record = await healthRecords.addRecord({
        ownerId: req.userId,
        petId: req.params.petId,
        kind,
        administeredAt,
        expiresAt,
        certificatePhoto,
        notes,
        intervalDays,
        label,
      });
      res
        .status(201)
        .json({ record, status: await healthRecords.statusFor(record.pet, req.userId) });
    } catch (err) {
      answer(res, err);
    }
  },

  async deleteRecord(req, res) {
    try {
      const deleted = await healthRecords.removeRecord({
        ownerId: req.userId,
        petId: req.params.petId,
        recordId: req.params.recordId,
      });
      res.json({
        recordId: deleted._id,
        status: await healthRecords.statusFor(req.params.petId, req.userId),
      });
    } catch (err) {
      answer(res, err);
    }
  },

  async markDone(req, res) {
    try {
      const record = await healthRecords.markDone({
        ownerId: req.userId,
        petId: req.params.petId,
        recordId: req.params.recordId,
      });
      res
        .status(201)
        .json({ record, status: await healthRecords.statusFor(record.pet, req.userId) });
    } catch (err) {
      answer(res, err);
    }
  },

  /**
   * The derived status of any pet, for a card.
   *
   * A status and nothing else: the records themselves are the owner's. This
   * is the same information the deck already attaches to every candidate, so
   * it reveals nothing a swipe would not.
   */
  async getStatus(req, res) {
    try {
      const pet = await Pet.findById(req.params.petId).select("_id").lean();
      if (!pet) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      const status = await vaccinations.statusFor(pet._id);
      res.json({ status, shared: vaccinations.isShared(status) });
    } catch (err) {
      answer(res, err);
    }
  },
};

module.exports = HealthRecordController;

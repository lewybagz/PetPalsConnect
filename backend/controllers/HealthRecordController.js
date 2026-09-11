const HealthRecord = require("../models/HealthRecord");
const Pet = require("../models/Pet");
const scheduler = require("../services/scheduler");
const { notify } = require("../services/NotificationService");
const { sanitisePhotos } = require("../services/photos");
const vaccinations = require("../services/vaccinations");

const VACCINATION_DUE_JOB = "vaccination:due";

const KIND_LABELS = {
  rabies: "rabies",
  dhpp: "DHPP",
  bordetella: "Bordetella",
  influenza: "canine influenza",
  leptospirosis: "leptospirosis",
  other: "vaccination",
};

/**
 * The reminder, registered once at module load like the review reminder.
 *
 * It re-reads the record rather than trusting the payload: a record removed
 * after the job was queued must not raise a reminder for a dose that no
 * longer exists, and a record re-entered with a new date has queued a job of
 * its own. ponytail: one job per record, no dedupe - an owner who edits a
 * date three times gets the latest reminder and two no-ops.
 */
scheduler.registerHandler(VACCINATION_DUE_JOB, async ({ recordId }) => {
  const record = await HealthRecord.findById(recordId).lean();
  if (!record?.expiresAt) return;

  const pet = await Pet.findById(record.pet).select("name").lean();
  if (!pet) return;

  const due = new Date(record.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  await notify({
    content: `${pet.name}'s ${KIND_LABELS[record.kind]} is due ${due}. Your vet can confirm the schedule.`,
    recipientId: record.owner,
    type: "vaccinationDue",
    petName: pet.name,
    data: { petId: String(record.pet) },
  });
});

/** The caller's own pet, or the response that says why not. */
const ownPet = async (req, res) => {
  const pet = await Pet.findById(req.params.petId).select("owner name").lean();
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

const HealthRecordController = {
  /** Everything recorded for one of the caller's pets, newest first, with the status. */
  async listRecords(req, res) {
    try {
      const pet = await ownPet(req, res);
      if (!pet) return;

      const records = await HealthRecord.find({ pet: pet._id, owner: req.userId })
        .sort({ administeredAt: -1 })
        .lean();

      res.json({
        status: vaccinations.statusOf(records),
        kinds: vaccinations.KINDS,
        coreKinds: vaccinations.CORE_KINDS,
        records,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Records a vaccination and queues its reminder.
   *
   * `verification` is derived, never taken from the body: `documented` means
   * a certificate photo is attached, and `verified` cannot be written by
   * anybody yet. A client that could set it would be a client that could
   * claim a checked certificate it does not have.
   */
  async createRecord(req, res) {
    try {
      const pet = await ownPet(req, res);
      if (!pet) return;

      const { kind, administeredAt, expiresAt, certificatePhoto, notes } = req.body;
      const [photo] = sanitisePhotos(certificatePhoto ? [certificatePhoto] : []);

      const record = await HealthRecord.create({
        pet: pet._id,
        owner: req.userId,
        creator: req.userId,
        kind,
        administeredAt,
        expiresAt: expiresAt || undefined,
        certificatePhoto: photo,
        verification: photo ? "documented" : "selfReported",
        notes,
      });

      const runAt = vaccinations.reminderAt(record.expiresAt);
      if (runAt) {
        await scheduler.schedule(VACCINATION_DUE_JOB, { recordId: String(record._id) }, runAt);
      }

      const records = await HealthRecord.find({ pet: pet._id, owner: req.userId })
        .select("kind administeredAt expiresAt")
        .lean();

      res.status(201).json({ record, status: vaccinations.statusOf(records) });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  },

  async deleteRecord(req, res) {
    try {
      // Scoped on the caller, so a record id from somebody else's pet finds nothing.
      const deleted = await HealthRecord.findOneAndDelete({
        _id: req.params.recordId,
        pet: req.params.petId,
        owner: req.userId,
      });
      if (!deleted) {
        return res.status(404).json({ message: "Cannot find that record" });
      }

      const records = await HealthRecord.find({ pet: req.params.petId, owner: req.userId })
        .select("kind administeredAt expiresAt")
        .lean();

      res.json({ recordId: deleted._id, status: vaccinations.statusOf(records) });
    } catch (err) {
      res.status(500).json({ message: err.message });
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
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = HealthRecordController;

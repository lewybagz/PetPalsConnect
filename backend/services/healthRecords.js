const HealthRecord = require("../models/HealthRecord");
const Pet = require("../models/Pet");
const scheduler = require("./scheduler");
const { notify } = require("./NotificationService");
const { sanitisePhotos } = require("./photos");
const vaccinations = require("./vaccinations");
const { ownPet } = require("./weights");

/**
 * The one writer of health records.
 *
 * Creating a record, marking one done and removing one each have a rule
 * attached - queue the reminder, "a vaccine has no cycle", scope on the owner
 * - and those rules used to live in `HealthRecordController`. They are here
 * because Spot's tools write records too, and a rule written in two places is
 * a rule one of them gets wrong. The controller is a thin caller now.
 *
 * Errors carry a `status` (`services/settings.js` convention); callers answer
 * with it.
 */

const VACCINATION_DUE_JOB = "vaccination:due";

const KIND_LABELS = {
  rabies: "rabies",
  dhpp: "DHPP",
  bordetella: "Bordetella",
  influenza: "canine influenza",
  leptospirosis: "leptospirosis",
  other: "vaccination",
  fleaTick: "flea and tick treatment",
  heartworm: "heartworm prevention",
  vetVisit: "check-up",
  medication: "medication",
};

/** What a reminder calls the thing: the medication's own name where it has one. */
const describeKind = (record) =>
  record.kind === "medication" && record.label ? record.label : KIND_LABELS[record.kind];

const fail = (status, message) => Object.assign(new Error(message), { status });

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
  const isVaccine = vaccinations.categoryOf(record.kind) === "vaccine";
  await notify({
    content: `${pet.name}'s ${describeKind(record)} is due ${due}. Your vet can confirm the schedule.`,
    recipientId: record.owner,
    type: isVaccine ? "vaccinationDue" : "healthDue",
    petName: pet.name,
    data: { petId: String(record.pet) },
  });
});

/** Writes one record and queues its reminder. Shared by add and done. */
const write = async (fields) => {
  const created = await HealthRecord.create(fields);
  const runAt = vaccinations.reminderAt(created.expiresAt);
  if (runAt) {
    await scheduler.schedule(VACCINATION_DUE_JOB, { recordId: String(created._id) }, runAt);
  }
  return created;
};

/** The derived status over the owner's own records for one pet. */
const statusFor = async (petId, ownerId) =>
  vaccinations.statusOf(
    await HealthRecord.find({ pet: petId, owner: ownerId })
      .select("kind administeredAt expiresAt")
      .lean()
  );

/**
 * Records a vaccination, treatment or identification and queues its reminder.
 *
 * `verification` is derived, never taken from the caller: `documented` means
 * a certificate photo is attached, and `verified` cannot be written by
 * anybody yet. A caller that could set it would be one that could claim a
 * checked certificate it does not have.
 */
const addRecord = async ({
  ownerId,
  petId,
  kind,
  administeredAt,
  expiresAt,
  certificatePhoto,
  notes,
  intervalDays,
  label,
}) => {
  const pet = await ownPet(ownerId, petId, "owner name");
  const [photo] = sanitisePhotos(certificatePhoto ? [certificatePhoto] : []);

  return write({
    pet: pet._id,
    owner: ownerId,
    creator: ownerId,
    kind,
    administeredAt,
    expiresAt: expiresAt || undefined,
    certificatePhoto: photo,
    verification: photo ? "documented" : "selfReported",
    intervalDays: intervalDays || undefined,
    label: label || undefined,
    notes,
  });
};

/**
 * "Done": today's dose is logged as the next record and the reminder is
 * re-armed from it. The record being marked stays - it is the history. Only
 * records with an interval repeat; a vaccine has a certificate date, not a
 * cycle, so "done" on one is a 400.
 */
const markDone = async ({ ownerId, petId, recordId }) => {
  const previous = await HealthRecord.findOne({ _id: recordId, pet: petId, owner: ownerId }).lean();
  if (!previous) throw fail(404, "Cannot find that record");

  const next = vaccinations.nextFrom(previous);
  if (!next) throw fail(400, "That record doesn't repeat");

  return write({
    ...next,
    pet: previous.pet,
    owner: ownerId,
    creator: ownerId,
    verification: "selfReported",
  });
};

/** Removes one record; scoped on the owner, so somebody else's id finds nothing. */
const removeRecord = async ({ ownerId, petId, recordId }) => {
  const deleted = await HealthRecord.findOneAndDelete({ _id: recordId, pet: petId, owner: ownerId });
  if (!deleted) throw fail(404, "Cannot find that record");
  return deleted;
};

module.exports = { VACCINATION_DUE_JOB, addRecord, markDone, removeRecord, statusFor };

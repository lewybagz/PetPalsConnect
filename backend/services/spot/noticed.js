const User = require("../../models/User");
const Pet = require("../../models/Pet");
const HealthRecord = require("../../models/HealthRecord");
const WeightEntry = require("../../models/WeightEntry");
const Playdate = require("../../models/Playdate");
const vaccinations = require("../vaccinations");
const { MEASURED_SPECIES } = require("../weights");

/**
 * What Spot would say first if it spoke first - built by software.
 *
 * The app already knows everything a nudge needs and never put it in one
 * place: a pending invitation, a lapsed vaccine, a treatment due this week,
 * a dog nobody has weighed since spring, a pet with no records at all. This
 * computes those on read, in a fixed order, and hands Home one sentence and
 * the question a tap should ask Spot. No model turn, nothing stored, nothing
 * scheduled: it is free, and it goes away when the thing is done.
 *
 * `noticesFor` is pure. `gather` reads for one owner.
 */

const DAY = 24 * 60 * 60 * 1000;
const TREATMENT_WINDOW_DAYS = 7;
const WEIGH_IN_STALE_DAYS = 90;
const MAX_NOTICES = 3;

const TREATMENT_LABELS = { fleaTick: "flea and tick treatment", heartworm: "heartworm dose" };

const describeTreatment = (record) =>
  record.label || TREATMENT_LABELS[record.kind] || (record.kind === "licence" ? "licence" : record.kind);

const dayWord = (dueAt, now) => {
  const days = Math.round((new Date(dueAt).getTime() - now) / DAY);
  if (days < 0) return `was due ${-days === 1 ? "yesterday" : `${-days} days ago`}`;
  if (days === 0) return "is due today";
  if (days === 1) return "is due tomorrow";
  return `is due in ${days} days`;
};

const months = (ms) => Math.max(1, Math.round(ms / (30 * DAY)));

/**
 * Notices in priority order, at most `MAX_NOTICES`.
 *
 * - `pets`: `[{ petId, name, species, recordCount }]`
 * - `statuses`: `Map<petId, vaccination status>`
 * - `dueRecords`: `[{ petId, kind, label, expiresAt }]`, repeating treatments only
 * - `lastWeighed`: `Map<petId, Date>` (absent = never)
 * - `pendingPlaydates`: `[{ playdateId, organiser, date }]`, invitations to the caller
 */
const noticesFor = ({
  pets = [],
  statuses = new Map(),
  dueRecords = [],
  lastWeighed = new Map(),
  pendingPlaydates = [],
  now = Date.now(),
} = {}) => {
  const notices = [];
  const nameOf = new Map(pets.map((pet) => [String(pet.petId), pet.name]));

  for (const playdate of pendingPlaydates) {
    notices.push({
      id: `playdate-${playdate.playdateId}`,
      kind: "invitation",
      text: `@${playdate.organiser}'s playdate invitation is waiting for an answer.`,
      question: `What's the playdate invitation from ${playdate.organiser} about?`,
      screen: "PlaydateDetails",
      params: { playdateId: String(playdate.playdateId) },
    });
  }

  for (const pet of pets) {
    const status = statuses.get(String(pet.petId)) ?? "unknown";
    const question = `Is ${pet.name} due for anything?`;
    if (status === "expired") {
      notices.push({ id: `vaccine-${pet.petId}`, kind: "vaccine", text: `${pet.name}'s core vaccinations have lapsed.`, question, screen: "PetHealth", params: { petId: String(pet.petId) } });
    } else if (status === "expiringSoon") {
      notices.push({ id: `vaccine-${pet.petId}`, kind: "vaccine", text: `One of ${pet.name}'s vaccinations is due within 30 days.`, question, screen: "PetHealth", params: { petId: String(pet.petId) } });
    } else if (status === "partial") {
      notices.push({ id: `vaccine-${pet.petId}`, kind: "vaccine", text: `${pet.name}'s records are missing a core vaccine.`, question, screen: "PetHealth", params: { petId: String(pet.petId) } });
    }
  }

  for (const record of dueRecords) {
    const name = nameOf.get(String(record.petId));
    if (!name || !record.expiresAt) continue;
    const due = new Date(record.expiresAt).getTime();
    if (due - now > TREATMENT_WINDOW_DAYS * DAY) continue;
    notices.push({
      id: `treatment-${record.recordId ?? record.petId}`,
      kind: "treatment",
      text: `${name}'s ${describeTreatment(record)} ${dayWord(due, now)}.`,
      question: `What is due for ${name} this week?`,
      screen: "PetHealth",
      params: { petId: String(record.petId) },
    });
  }

  for (const pet of pets) {
    if (!MEASURED_SPECIES.includes(pet.species ?? "dog")) continue;
    const last = lastWeighed.get(String(pet.petId));
    const age = last ? now - new Date(last).getTime() : null;
    if (age !== null && age < WEIGH_IN_STALE_DAYS * DAY) continue;
    notices.push({
      id: `weight-${pet.petId}`,
      kind: "weight",
      text: last ? `${pet.name} hasn't been weighed in ${months(age)} months.` : `${pet.name} has never been weighed here.`,
      question: `Log a weigh-in for ${pet.name}`,
      screen: "PetWeight",
      params: { petId: String(pet.petId) },
    });
  }

  for (const pet of pets) {
    if ((pet.recordCount ?? 0) > 0) continue;
    notices.push({
      id: `records-${pet.petId}`,
      kind: "records",
      text: `${pet.name} has no health records yet.`,
      question: `Add ${pet.name}'s vaccination dates`,
      screen: "PetHealth",
      params: { petId: String(pet.petId) },
    });
  }

  return notices.slice(0, MAX_NOTICES);
};

/** Reads everything `noticesFor` needs for one owner. */
const gather = async (userId, { now = Date.now() } = {}) => {
  const owner = await User.findById(userId).select("pets").lean();
  const petRows = await Pet.find({ _id: { $in: owner?.pets ?? [] } }).select("name species").lean();
  const petIds = petRows.map((pet) => pet._id);
  const [statuses, records, weighIns, playdates] = await Promise.all([
    vaccinations.statusForPets(petIds),
    HealthRecord.find({ owner: userId, pet: { $in: petIds } }).select("pet kind label expiresAt intervalDays").lean(),
    WeightEntry.aggregate([
      { $match: { pet: { $in: petIds } } },
      { $sort: { takenAt: -1 } },
      { $group: { _id: "$pet", takenAt: { $first: "$takenAt" } } },
    ]),
    Playdate.find({ participants: userId, creator: { $ne: userId }, status: "pending", date: { $gte: new Date(now) } })
      .populate("creator", "username")
      .sort({ date: 1 })
      .limit(3)
      .lean(),
  ]);

  const recordCount = new Map();
  for (const record of records) {
    const key = String(record.pet);
    recordCount.set(key, (recordCount.get(key) ?? 0) + 1);
  }

  return noticesFor({
    now,
    pets: petRows.map((pet) => ({
      petId: String(pet._id),
      name: pet.name,
      species: pet.species ?? "dog",
      recordCount: recordCount.get(String(pet._id)) ?? 0,
    })),
    statuses,
    // Only kinds that repeat: a vaccine's date is covered by the status above.
    dueRecords: records
      .filter((record) => record.intervalDays && record.expiresAt)
      .map((record) => ({
        recordId: String(record._id),
        petId: String(record.pet),
        kind: record.kind,
        label: record.label,
        expiresAt: record.expiresAt,
      })),
    lastWeighed: new Map(weighIns.map((row) => [String(row._id), row.takenAt])),
    pendingPlaydates: playdates
      .filter((row) => row.creator?.username)
      .map((row) => ({ playdateId: String(row._id), organiser: row.creator.username, date: row.date })),
  });
};

module.exports = { noticesFor, gather, MAX_NOTICES, TREATMENT_WINDOW_DAYS, WEIGH_IN_STALE_DAYS };

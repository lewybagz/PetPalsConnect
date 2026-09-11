/**
 * Whether a pet's vaccinations are current, answered once.
 *
 * Three places ask - the owner's own health screen, the deck card a stranger
 * sees, and the reminder job - and a rule written three times is a rule one of
 * them gets wrong. Same reasoning that put blocking in `blocking.js` and "who
 * may reach me" in `audience.js`.
 *
 * This file stores what a vet already did and works out a date. It never
 * recommends a schedule, suggests a vaccine, or says a dog is safe: the
 * content rule in CLAUDE.md ("describes published guidance, never prescribes")
 * applies to code as much as to articles.
 */

/**
 * The vaccines an owner can record. The three core ones are what every
 * daycare, boarder and group class in North America asks to see (2022 AAHA
 * Canine Vaccination Guidelines list rabies and DHPP as core, and Bordetella
 * as "core for the individual" once a dog is in regular group contact).
 */
const KINDS = ["rabies", "dhpp", "bordetella", "influenza", "leptospirosis", "other"];

/** A pet is "current" when its latest record of each of these has not lapsed. */
const CORE_KINDS = ["rabies", "dhpp", "bordetella"];

const VERIFICATIONS = ["selfReported", "documented", "verified"];

const STATUSES = ["unknown", "partial", "expired", "expiringSoon", "current"];

/**
 * Statuses that count as "vaccinations shared" to somebody else.
 *
 * `expiringSoon` is still shared: the record is there and has not lapsed.
 * `partial` is not, because one certificate out of three is not what a
 * facility would accept either.
 */
const SHARED_STATUSES = ["current", "expiringSoon"];

/**
 * How far ahead a reminder lands.
 *
 * ponytail: 30 days is judgement, not sourced. Bordetella's "at least 7 days
 * before arrival" rule is the only hard number in the guidance; a month gives
 * an owner time to book. Make it a setting if people ask for a different lead.
 */
const REMINDER_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

const time = (value) => (value ? new Date(value).getTime() : null);

/** The newest record of each kind. */
const latestByKind = (records) => {
  const latest = new Map();
  for (const record of records) {
    const current = latest.get(record.kind);
    if (!current || time(record.administeredAt) > time(current.administeredAt)) {
      latest.set(record.kind, record);
    }
  }
  return latest;
};

/**
 * A pet's status from its records. Pure, so the boundaries can be tested
 * without a database.
 *
 * `expired` outranks `partial`: a lapsed rabies certificate is the thing to
 * say, whether or not a bordetella one was ever entered. A record with no
 * `expiresAt` never lapses - the owner chose not to enter a date, and
 * inventing one would be prescribing.
 */
const statusOf = (records = [], now = Date.now()) => {
  if (records.length === 0) return "unknown";

  const latest = latestByKind(records);
  const core = CORE_KINDS.map((kind) => latest.get(kind));
  const expiries = core.map((record) => time(record?.expiresAt));

  if (expiries.some((expiry) => expiry !== null && expiry < now)) return "expired";
  if (core.some((record) => !record)) return "partial";
  if (expiries.some((expiry) => expiry !== null && expiry - now <= REMINDER_LEAD_MS)) {
    return "expiringSoon";
  }
  return "current";
};

const isShared = (status) => SHARED_STATUSES.includes(status);

/**
 * Status for many pets in one query, for the deck.
 *
 * Required lazily so the model can require this file for its enums without a
 * cycle.
 */
const statusForPets = async (petIds) => {
  const HealthRecord = require("../models/HealthRecord");
  const ids = petIds.map(String);
  const statuses = new Map(ids.map((id) => [id, "unknown"]));
  if (ids.length === 0) return statuses;

  const records = await HealthRecord.find({ pet: { $in: ids } })
    .select("pet kind administeredAt expiresAt")
    .lean();

  const byPet = new Map();
  for (const record of records) {
    const key = String(record.pet);
    if (!byPet.has(key)) byPet.set(key, []);
    byPet.get(key).push(record);
  }
  for (const [petId, petRecords] of byPet) statuses.set(petId, statusOf(petRecords));

  return statuses;
};

const statusFor = async (petId) => (await statusForPets([petId])).get(String(petId));

/** When to remind about a record, or null when there is nothing to remind about. */
const reminderAt = (expiresAt, now = Date.now()) => {
  const expiry = time(expiresAt);
  if (expiry === null || expiry <= now) return null;
  return new Date(Math.max(now, expiry - REMINDER_LEAD_MS));
};

module.exports = {
  KINDS,
  CORE_KINDS,
  VERIFICATIONS,
  STATUSES,
  SHARED_STATUSES,
  REMINDER_LEAD_MS,
  statusOf,
  isShared,
  statusFor,
  statusForPets,
  reminderAt,
};

import api from "./axios";

/**
 * Health records, from the app's side.
 *
 * The records belong to the owner and only the owner ever receives them. What
 * everybody else sees is a derived vaccination status - `current`, `partial`,
 * `unknown` - which is the same thing the deck attaches to every candidate. The
 * copy for that status lives here, once, because the card, the confirmation
 * screen and the owner's own screen all show it and "shared" must mean the same
 * thing on all three.
 *
 * None of this verifies anything. A record is what the owner typed, a
 * `documented` one has a photo attached, and the words on screen say so.
 */

/** Mirrors `KIND_CATEGORIES` in `backend/services/vaccinations.js`, with labels. */
export const KIND_LABELS = {
  rabies: "Rabies",
  dhpp: "DHPP",
  bordetella: "Bordetella",
  influenza: "Canine influenza",
  leptospirosis: "Leptospirosis",
  other: "Other vaccine",
  fleaTick: "Flea and tick",
  heartworm: "Heartworm",
  vetVisit: "Vet visit",
  medication: "Medication",
};

export const KIND_CATEGORIES = {
  rabies: "vaccine",
  dhpp: "vaccine",
  bordetella: "vaccine",
  influenza: "vaccine",
  leptospirosis: "vaccine",
  other: "vaccine",
  fleaTick: "prevention",
  heartworm: "prevention",
  vetVisit: "visit",
  medication: "medication",
};

export const CATEGORY_LABELS = {
  vaccine: "Vaccinations",
  prevention: "Flea, tick and heartworm",
  visit: "Vet visits",
  medication: "Medications",
};

/** The order the screen shows them in: what strangers see first. */
export const CATEGORY_ORDER = ["vaccine", "prevention", "visit", "medication"];

/**
 * A starting number for the kinds that repeat - the common monthly cycle,
 * pre-filled so the owner changes it rather than invents it. The screen says
 * "as your vet prescribed" beside it; this is a default, not advice.
 */
export const DEFAULT_INTERVALS = {
  fleaTick: 30,
  heartworm: 30,
  medication: 30,
};

export const categoryOf = (kind) => KIND_CATEGORIES[kind] ?? "vaccine";

/** Whether a kind is entered with an interval and can be marked "done". */
export const repeats = (kind) =>
  categoryOf(kind) === "prevention" || categoryOf(kind) === "medication";

/** The owner's records for one of their pets, with the status. */
export const fetchHealth = async (petId) => {
  const { data } = await api.get(`/api/pets/${petId}/health`);
  return {
    status: data?.status ?? "unknown",
    kinds: Array.isArray(data?.kinds) ? data.kinds : Object.keys(KIND_LABELS),
    coreKinds: Array.isArray(data?.coreKinds) ? data.coreKinds : [],
    records: Array.isArray(data?.records) ? data.records : [],
  };
};

export const addHealthRecord = async (petId, record) => {
  const { data } = await api.post(`/api/pets/${petId}/health`, record);
  return data;
};

export const removeHealthRecord = async (petId, recordId) => {
  const { data } = await api.delete(`/api/pets/${petId}/health/${recordId}`);
  return data;
};

/** Logs today's dose of a repeating record; the server writes the next one. */
export const markDone = async (petId, recordId) => {
  const { data } = await api.post(`/api/pets/${petId}/health/${recordId}/done`);
  return data;
};

/** Any pet's derived status. Never the records. */
export const fetchVaccinationStatus = async (petId) => {
  const { data } = await api.get(`/api/pets/${petId}/health/status`);
  return data?.status ?? "unknown";
};

/**
 * What a status means to somebody *else*, for a card.
 *
 * "Shared", never "safe" or "verified": the owner entered these dates and
 * nobody here checked a certificate. The trailing note keeps that on the same
 * line as the claim, so the two cannot be read apart.
 */
export const describeVaccination = (status) => {
  switch (status) {
    case "current":
    case "expiringSoon":
      return { label: "Vaccinations shared", note: "owner-reported", tone: "success", icon: "shield-checkmark-outline" };
    case "partial":
      return { label: "Some vaccinations shared", note: "owner-reported", tone: "warning", icon: "shield-half-outline" };
    case "expired":
      return { label: "Vaccination records out of date", note: null, tone: "warning", icon: "shield-outline" };
    case "unknown":
      return { label: "No vaccination info shared", note: null, tone: "muted", icon: "shield-outline" };
    default:
      return null;
  }
};

/**
 * What a status means to the owner, on their own screen.
 *
 * Names the three vaccines a facility asks for, and stops there - which ones
 * a particular dog needs is a conversation with a vet, not a sentence here.
 */
export const describeForOwner = (status) => {
  switch (status) {
    case "current":
      return "Rabies, DHPP and Bordetella are all recorded and in date.";
    case "expiringSoon":
      return "One of the core vaccinations is due within the next 30 days.";
    case "expired":
      return "A core vaccination has lapsed, going by the dates you entered.";
    case "partial":
      return "Rabies, DHPP and Bordetella are what most daycares and boarders ask to see. Not all three are recorded yet.";
    default:
      return "Your vet's certificate has the dates for each one.";
  }
};

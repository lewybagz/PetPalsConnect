/**
 * What a person can change about how the app treats them, in one place.
 *
 * Settings were spread across three shapes that disagreed. `updateUserSettings`
 * took three named fields and wrote all three on every call, so a client
 * sending only `playdateRange` also set `notificationsEnabled` and
 * `locationSharingEnabled` - and the app's Privacy screen had two toggles that
 * wrote nowhere at all, one of which duplicated a toggle on the Settings screen
 * that did save. Two screens, one real answer, and no way to tell which.
 *
 * So: one schema, one validator, one writer. A setting that is not in this file
 * cannot be written, and a setting in this file is enforced somewhere - the
 * tests in `settings.test.js` and `settingsEnforcement.test.js` are what keep
 * that true.
 *
 * Device preferences deliberately live on the device. Theme, reduced motion,
 * larger text and haptics are properties of a phone rather than an account: the
 * server has no use for them, and syncing them would add a round trip and a
 * failure mode to a switch that has to feel instant. They persist in
 * AsyncStorage in the app.
 */

/** Distance and weight are stored canonically; these choose how they read. */
const UNIT_CHOICES = {
  distance: ["mi", "km"],
  weight: ["lb", "kg"],
};

/** Who may reach you. Ordered from most open to most closed. */
const AUDIENCES = ["everyone", "matches", "friends"];

/** Friend requests have their own scale - "matches" makes no sense for one. */
const REQUEST_AUDIENCES = ["everyone", "friendsOfFriends", "nobody"];

const SPECIES = ["dog", "cat", "rabbit", "bird", "other"];

/**
 * The whole surface, as a validator per leaf.
 *
 * Each entry returns the value to store, or throws. Nesting matches the shape
 * on `User`, so a partial update can be walked against it without a second
 * description of the same thing getting out of step.
 */
const invalid = (path, reason) => {
  const error = new Error(`${path} ${reason}`);
  error.status = 400;
  error.code = "INVALID_SETTING";
  return error;
};

const bool = (value, path) => {
  if (typeof value !== "boolean") throw invalid(path, "must be true or false");
  return value;
};

const oneOf = (choices) => (value, path) => {
  if (!choices.includes(value)) {
    throw invalid(path, `must be one of ${choices.join(", ")}`);
  }
  return value;
};

const number = ({ min, max, integer = false }) => (value, path) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw invalid(path, "must be a number");
  }
  if (integer && !Number.isInteger(value)) throw invalid(path, "must be a whole number");
  if (value < min || value > max) throw invalid(path, `must be between ${min} and ${max}`);
  return value;
};

const listOf = (choices) => (value, path) => {
  if (!Array.isArray(value)) throw invalid(path, "must be a list");
  const unknown = value.find((entry) => !choices.includes(entry));
  if (unknown !== undefined) throw invalid(path, `cannot include ${unknown}`);
  // Deduped so the stored value is the set it is meant to be.
  return [...new Set(value)];
};

/** "HH:MM", 24-hour. A time is a string here because it has no date. */
const timeOfDay = (value, path) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw invalid(path, "must be a time like 22:00");
  }
  return value;
};

const SCHEMA = {
  /** How far somebody will travel for a playdate. 0 means no limit. */
  playdateRange: number({ min: 0, max: 500 }),
  locationSharingEnabled: bool,
  notificationsEnabled: bool,

  units: {
    distance: oneOf(UNIT_CHOICES.distance),
    weight: oneOf(UNIT_CHOICES.weight),
  },

  /**
   * Narrows the deck. Stored in the canonical units - pounds and years - so
   * the matching engine never has to know what the owner reads them in.
   */
  discovery: {
    minWeight: number({ min: 0, max: 300 }),
    maxWeight: number({ min: 0, max: 300 }),
    minAge: number({ min: 0, max: 30, integer: true }),
    maxAge: number({ min: 0, max: 30, integer: true }),
    species: listOf(SPECIES),
    // Somebody who has never shared a position has a null distance. Excluding
    // them empties the deck early on, so it is a choice rather than a default.
    includeUnknownDistance: bool,
  },

  privacy: {
    profileVisibility: oneOf(AUDIENCES),
    messagesFrom: oneOf(AUDIENCES),
    friendRequestsFrom: oneOf(REQUEST_AUDIENCES),
    discoverableInSearch: bool,
    showOnMap: bool,
  },
};

/** The defaults, which are also what the schema documents as sensible. */
const DEFAULTS = {
  units: { distance: "mi", weight: "lb" },
  discovery: {
    minWeight: 0,
    maxWeight: 300,
    minAge: 0,
    maxAge: 30,
    species: [],
    includeUnknownDistance: true,
  },
  privacy: {
    profileVisibility: "everyone",
    messagesFrom: "everyone",
    friendRequestsFrom: "everyone",
    discoverableInSearch: true,
    showOnMap: true,
  },
};

/**
 * Validates a partial update and returns a flat `$set` for Mongoose.
 *
 * Flat dotted paths rather than whole objects, because `{ privacy: { showOnMap:
 * false } }` as a `$set` replaces the entire `privacy` subdocument and silently
 * drops every other key in it - which is the same class of bug as the old
 * three-field update, one level down.
 */
const buildUpdate = (patch, schema = SCHEMA, prefix = "") => {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw invalid(prefix || "settings", "must be an object");
  }

  const update = {};

  for (const [key, value] of Object.entries(patch)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const rule = schema[key];

    if (!rule) throw invalid(path, "is not a setting");
    // `undefined` is "not mentioned", which a partial update is entitled to do.
    if (value === undefined) continue;

    if (typeof rule === "function") {
      update[path] = rule(value, path);
    } else {
      Object.assign(update, buildUpdate(value, rule, path));
    }
  }

  return update;
};

/**
 * Rules a single leaf cannot express.
 *
 * A minimum above its maximum matches nothing, and an empty deck looks
 * identical to a broken one - so it is refused rather than stored.
 */
const checkRanges = (update, current = {}) => {
  const value = (path, fallback) =>
    Object.hasOwn(update, path) ? update[path] : fallback;

  const discovery = { ...DEFAULTS.discovery, ...(current.discovery ?? {}) };

  const minWeight = value("discovery.minWeight", discovery.minWeight);
  const maxWeight = value("discovery.maxWeight", discovery.maxWeight);
  if (minWeight > maxWeight) {
    throw invalid("discovery.minWeight", "cannot be above discovery.maxWeight");
  }

  const minAge = value("discovery.minAge", discovery.minAge);
  const maxAge = value("discovery.maxAge", discovery.maxAge);
  if (minAge > maxAge) {
    throw invalid("discovery.minAge", "cannot be above discovery.maxAge");
  }
};

/** Validate a patch against the current document. Returns the `$set`. */
const updateFor = (patch, current) => {
  const update = buildUpdate(patch);
  checkRanges(update, current);
  return update;
};

/** Fills in what a document has not set, so callers never handle undefined. */
const withDefaults = (user = {}) => ({
  units: { ...DEFAULTS.units, ...(user.units ?? {}) },
  discovery: { ...DEFAULTS.discovery, ...(user.discovery ?? {}) },
  privacy: { ...DEFAULTS.privacy, ...(user.privacy ?? {}) },
});

module.exports = {
  SCHEMA,
  DEFAULTS,
  AUDIENCES,
  REQUEST_AUDIENCES,
  SPECIES,
  UNIT_CHOICES,
  updateFor,
  withDefaults,
  timeOfDay,
};

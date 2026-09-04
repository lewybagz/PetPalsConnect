/**
 * How far apart two people are, and how far each is willing to travel.
 *
 * Matching scored temperament, size, activities, breed and age, and ignored
 * distance completely - so discovery would happily offer a perfectly-matched
 * dog on another continent, in an app whose entire point is arranging to meet.
 * `playdateRange` existed as a preference and enforced nothing.
 *
 * Distance filters rather than scores. You do not want a great match ranked
 * below a mediocre one because it is nearer; you want only pets you could
 * actually meet, ranked by how well they fit. It breaks ties, and nothing else.
 */

const EARTH_RADIUS_MILES = 3958.8;

/**
 * The enum `playdateRange` used to be, kept so rows written before it became a
 * number still mean something.
 */
const LEGACY_RANGE_MILES = {
  All: null,
  "Within 10 miles": 10,
  "Within 20 miles": 20,
  "Within 50 miles": 50,
};

/**
 * Miles for a stored range preference; null when there is no limit.
 *
 * `playdateRange` is a number of miles now, with 0 meaning unlimited. The old
 * strings still resolve, because a preference someone set last year should not
 * silently become "everywhere".
 */
const rangeToMiles = (range) => {
  if (typeof range === "number") {
    return Number.isFinite(range) && range > 0 ? range : null;
  }
  return LEGACY_RANGE_MILES[range] ?? null;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in miles between two `[longitude, latitude]` pairs.
 *
 * Note the order: GeoJSON is longitude first, which is the opposite of how
 * everyone says it out loud, and mixing them up puts London in Antarctica.
 */
const milesBetween = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  if (a.length < 2 || b.length < 2) return null;

  const [lonA, latA] = a;
  const [lonB, latB] = b;
  if ([lonA, latA, lonB, latB].some((value) => typeof value !== "number")) {
    return null;
  }

  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** True when a coordinate pair is real and on the planet. */
const isValidCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [longitude, latitude] = coordinates;
  if (typeof longitude !== "number" || typeof latitude !== "number") return false;
  if (Number.isNaN(longitude) || Number.isNaN(latitude)) return false;
  return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
};

/** GeoJSON coordinates from a `{ latitude, longitude }` request body. */
const toCoordinates = ({ latitude, longitude } = {}) => {
  const pair = [Number(longitude), Number(latitude)];
  return isValidCoordinates(pair) ? pair : null;
};

/**
 * Filters candidates to those within range and attaches their distance.
 *
 * A candidate whose owner has not shared a position is kept: excluding them
 * would empty the deck for everyone early on, when almost nobody has. They
 * come back with `distanceMiles: null`, and the app says "distance unknown"
 * rather than inventing one.
 */
const withinRange = (origin, candidates, maxMiles) =>
  candidates
    .map((candidate) => ({
      ...candidate,
      distanceMiles: milesBetween(origin, candidate.coordinates),
    }))
    .filter((candidate) => {
      if (maxMiles == null) return true;
      if (candidate.distanceMiles == null) return true;
      return candidate.distanceMiles <= maxMiles;
    });

/** One decimal place, which is as precise as "how far away" ever needs to be. */
const formatMiles = (miles) =>
  miles == null ? null : Math.round(miles * 10) / 10;

module.exports = {
  EARTH_RADIUS_MILES,
  LEGACY_RANGE_MILES,
  rangeToMiles,
  milesBetween,
  isValidCoordinates,
  toCoordinates,
  withinRange,
  formatMiles,
};

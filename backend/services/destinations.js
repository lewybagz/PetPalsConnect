/**
 * The places somebody can look up while planning a trip.
 *
 * This list started inside `scripts/importArizona.js`, where it named the
 * cities the places directory is seeded for. It is here now because two
 * callers need it and a list written twice is a list one copy gets wrong: the
 * importer decides where to pull rows *into*, and the care hub's destination
 * search decides where an owner can usefully look. Those must be the same
 * places - offering a city with nothing imported is an empty list with no
 * explanation, which is the failure mode the hub already works hard to avoid.
 *
 * Why a list rather than a geocoder: geocoding an arbitrary string is a billed
 * Google call on every keystroke, and it would cheerfully return a city where
 * this app has no rows at all. A short list of places that genuinely have data
 * is the honest version, and it grows when the importer does.
 *
 * 78% of US pet owners have travelled with a pet and searches for pet-friendly
 * accommodation rose about 40% between 2023 and 2025, so "where can I take the
 * dog in Tucson" is a real question - it just has a bounded answer here.
 *
 * Populations are Census Vintage 2025 estimates, which is what chose the six:
 * every Arizona city over 250,000.
 */
const DESTINATIONS = [
  { id: "phoenix", name: "Phoenix", region: "AZ", population: 1665481, latitude: 33.4484, longitude: -112.074 },
  { id: "tucson", name: "Tucson", region: "AZ", population: 548371, latitude: 32.2226, longitude: -110.9747 },
  { id: "mesa", name: "Mesa", region: "AZ", population: 513656, latitude: 33.4152, longitude: -111.8315 },
  { id: "gilbert", name: "Gilbert", region: "AZ", population: 287285, latitude: 33.3528, longitude: -111.789 },
  { id: "chandler", name: "Chandler", region: "AZ", population: 278748, latitude: 33.3062, longitude: -111.8413 },
  { id: "glendale", name: "Glendale", region: "AZ", population: 260572, latitude: 33.5387, longitude: -112.186 },
];

/** Miles. Phoenix is wide; the East Valley cities overlap, which the upsert absorbs. */
const RADIUS_MILES = 12;

const byId = (id) => DESTINATIONS.find((city) => city.id === id) ?? null;

module.exports = { DESTINATIONS, RADIUS_MILES, byId };

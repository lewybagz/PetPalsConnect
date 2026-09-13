const test = require("node:test");
const assert = require("node:assert/strict");

const places = require("../services/places");

/**
 * Translating a Places API (New) response into a `Location`.
 *
 * The legacy Places API cannot be enabled on new Google Cloud projects any
 * more - it answers "You're calling a legacy API, which is not enabled for
 * your project" whatever the key looks like - so these calls moved to
 * `places.googleapis.com`. Almost every field was renamed in the process, and
 * the dangerous part is that the renames fail *quietly*: a missing field reads
 * as `undefined` and writes a row that looks fine until somebody opens it.
 *
 * These are the three that would have shipped wrong, so these are the tests.
 */

const PLACE = {
  id: "ChIJj61dQgK6j4AR4GeTYWZsKWw",
  // In the new API this is the *resource path*, not the human name. Reading it
  // the way the legacy code read `name` is the trap this fixture exists for.
  name: "places/ChIJj61dQgK6j4AR4GeTYWZsKWw",
  displayName: { text: "Desert Paws Veterinary", languageCode: "en" },
  formattedAddress: "123 E Camelback Rd, Phoenix, AZ 85012, USA",
  location: { latitude: 33.5092, longitude: -112.0748 },
  types: ["veterinary_care", "point_of_interest", "establishment"],
  rating: 4.6,
};

test("the human name comes from displayName, never from `name`", () => {
  const row = places.toLocation(PLACE, "vet");

  assert.equal(row.name, "Desert Paws Veterinary");
  // `Location.name` is required, so writing the resource path here would pass
  // validation and render "places/ChIJ..." on every card.
  assert.ok(!String(row.name).startsWith("places/"));
});

test("the place id comes from `id`, not from `name`", () => {
  // `placeId` is uniquely indexed and is what the importer upserts on. Getting
  // it wrong would duplicate every row on the next import instead of merging.
  assert.equal(places.toLocation(PLACE, "vet").placeId, "ChIJj61dQgK6j4AR4GeTYWZsKWw");
});

test("coordinates are stored GeoJSON order, from the renamed keys", () => {
  const row = places.toLocation(PLACE, "vet");

  // Google now spells them in full and drops the `geometry` wrapper. GeoJSON
  // is [longitude, latitude] - the order that puts a Phoenix vet in the sea if
  // it is reversed.
  assert.deepEqual(row.geoLocation, {
    type: "Point",
    coordinates: [-112.0748, 33.5092],
  });
});

test("the category the search was for is carried onto the row", () => {
  // Unchanged behaviour, but it runs through the new `types` array: a groomer
  // comes back typed `pet_store` and is otherwise indistinguishable from a shop.
  const row = places.toLocation({ ...PLACE, types: ["pet_store"] }, "groomer");
  assert.ok(row.categories.includes("groomer"));
});

test("a place missing the fields the schema needs is recognisable as such", () => {
  // `search` filters these out. The mapper's job is to report the absence
  // rather than invent a name.
  const row = places.toLocation({ id: "x", location: { latitude: 1, longitude: 2 } }, "vet");
  assert.equal(row.name, null);
  assert.equal(row.address, "");
});

// --- The text-search radius -------------------------------------------------

const circle = {
  center: { latitude: 33.4484, longitude: -112.074 },
  radius: 12 * places.METRES_PER_MILE,
};

test("a text-search result outside the circle is dropped", () => {
  /**
   * Nearby Search takes a `locationRestriction` and honours it. Text Search -
   * which is the only way to search a keyword now, so every patio, hotel,
   * trail, groomer and boarder goes through it - takes a *bias*, and will
   * happily answer with a hotel in Tucson once the Phoenix ones run out.
   */
  const phoenix = places.toLocation(
    { ...PLACE, location: { latitude: 33.4484, longitude: -112.074 } },
    "hotel"
  );
  const tucson = places.toLocation(
    { ...PLACE, location: { latitude: 32.2226, longitude: -110.9747 } },
    "hotel"
  );

  assert.equal(places.withinRadius(phoenix, circle), true);
  assert.equal(places.withinRadius(tucson, circle), false, "120 miles is not nearby");
});

test("a place Google could not locate is not treated as nearby", () => {
  const nowhere = places.toLocation({ ...PLACE, location: undefined }, "hotel");
  assert.equal(places.withinRadius(nowhere, circle), false);
});

test("the radius is a real edge, not a rounding", () => {
  // Just inside and just outside 12 miles, north of the centre. A degree of
  // latitude is ~69 miles.
  const near = places.toLocation(
    { ...PLACE, location: { latitude: 33.4484 + 11 / 69, longitude: -112.074 } },
    "patio"
  );
  const far = places.toLocation(
    { ...PLACE, location: { latitude: 33.4484 + 13 / 69, longitude: -112.074 } },
    "patio"
  );

  assert.equal(places.withinRadius(near, circle), true);
  assert.equal(places.withinRadius(far, circle), false);
});

// --- Configuration ----------------------------------------------------------

test("no key means the service is off, not broken", () => {
  const original = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  try {
    assert.equal(places.isEnabled(), false);
  } finally {
    if (original !== undefined) process.env.GOOGLE_MAPS_API_KEY = original;
  }
});

test("searching with no key refuses with 503 rather than calling out", async () => {
  const original = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  try {
    await assert.rejects(
      () => places.search({ latitude: 33.4, longitude: -112, type: "park" }),
      (error) => error.status === 503
    );
  } finally {
    if (original !== undefined) process.env.GOOGLE_MAPS_API_KEY = original;
  }
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const destinations = require("../services/destinations");
const { LAUNCH_REGIONS } = require("../services/regions");

let app;
let User;
let Location;

/**
 * Looking somewhere you are not.
 *
 * The endpoint already took a `lat`/`lng` pair, so travel search needed no new
 * route - what was missing was a way to name a city. That list is deliberately
 * bounded rather than a geocoder: geocoding an arbitrary string is a billed
 * call that would cheerfully return a city where this app holds no rows, and
 * an empty list with no explanation is the failure mode the hub works hardest
 * to avoid.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Location = require("../models/Location");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeUser = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });

const makePlace = (name, categories, [longitude, latitude]) =>
  Location.create({
    name,
    address: `${name} Street`,
    placeId: `place-${name.toLowerCase().replace(/\s+/g, "-")}`,
    categories,
    geoLocation: { type: "Point", coordinates: [longitude, latitude] },
  });

test("every destination is somewhere the importer actually seeds", () => {
  /**
   * The two lists have to be the same places, which is why the importer now
   * reads this one. A destination the importer skips is a city that looks
   * available and answers with nothing.
   */
  const { DESTINATIONS } = destinations;
  assert.ok(DESTINATIONS.length >= 6);

  const ids = new Set();
  for (const city of DESTINATIONS) {
    assert.match(city.id, /^[a-z-]+$/, `${city.name} has a url-safe id`);
    assert.ok(!ids.has(city.id), `${city.id} is unique`);
    ids.add(city.id);

    assert.ok(city.name?.trim());
    assert.ok(Number.isFinite(city.latitude) && Number.isFinite(city.longitude));
    // Every one is inside the launch fence: offering a city the app is not
    // open in would be advertising a deck nobody can use.
    assert.ok(LAUNCH_REGIONS.includes(city.region), `${city.name} is in a launch region`);
    // The rule that chose them: Census Vintage 2025, over 250,000.
    assert.ok(city.population > 250000, `${city.name} is over the population line`);
  }
});

test("the importer and the hub read the same list", () => {
  // Not two copies that drift: `scripts/importArizona.js` requires this module.
  const { CITIES, RADIUS_MILES } = require("../scripts/importArizona");
  assert.equal(CITIES, destinations.DESTINATIONS);
  assert.equal(RADIUS_MILES, destinations.RADIUS_MILES);
});

test("the hub is told where it can look", async () => {
  await makeUser("owner");

  const res = await request(app)
    .get("/api/petcare/picks")
    .set(...auth("owner"))
    .expect(200);

  assert.ok(Array.isArray(res.body.destinations));
  assert.ok(res.body.destinations.some((city) => city.name === "Tucson"));
});

test("a destination search answers about there, not about here", async () => {
  await makeUser("owner");

  const tucson = destinations.byId("tucson");
  const phoenix = destinations.byId("phoenix");

  await makePlace("Tucson Dog Patio", ["patio"], [tucson.longitude, tucson.latitude]);
  await makePlace("Phoenix Dog Patio", ["patio"], [phoenix.longitude, phoenix.latitude]);

  // The caller is in Phoenix and asks about Tucson.
  const res = await request(app)
    .get("/api/locations/care")
    .query({
      lat: tucson.latitude,
      lng: tucson.longitude,
      range: 12,
      category: "patio",
    })
    .set(...auth("owner"))
    .expect(200);

  const names = res.body.places.map((place) => place.name);
  assert.ok(names.includes("Tucson Dog Patio"));
  assert.ok(!names.includes("Phoenix Dog Patio"), "120 miles away is not nearby");
});

test("an unknown destination id is nothing, not a guess", () => {
  assert.equal(destinations.byId("seattle"), null);
  assert.equal(destinations.byId(""), null);
  assert.equal(destinations.byId(undefined), null);
});

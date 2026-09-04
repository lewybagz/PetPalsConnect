const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const places = require("../services/places");

/**
 * The map.
 *
 * It has never rendered a marker. `MapScreen` read `pet.location.lat` on rows
 * from `/api/petmatches/matched-pets`, which returns PetMatch documents - and a
 * pet has no coordinates at all, because the position lives on its owner. The
 * places half was worse: the near-query wrote a PascalCase `GeoLocation` key
 * against a lowercase schema path, so `$nearSphere` searched a field that does
 * not exist and returned nothing on every request, which is indistinguishable
 * from an empty collection - and the collection was also empty, because nothing
 * ever created a row.
 */

let app;
let User;
let Pet;
let PetMatch;
let Location;

// San Francisco, and a park a few blocks away.
const HERE = [-122.4324, 37.78825];
const NEARBY = [-122.4294, 37.79025];
const FAR = [-74.006, 40.7128]; // New York

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  PetMatch = require("../models/PetMatch");
  Location = require("../models/Location");
});

test.after(async () => {
  await harness.stop();
  delete process.env.GOOGLE_MAPS_API_KEY;
});

test.beforeEach(async () => {
  await harness.clear();
  delete process.env.GOOGLE_MAPS_API_KEY;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = (uid, coordinates = HERE) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    usernameLower: uid.toLowerCase(),
    email: `${uid}@example.test`,
    geoLocation: coordinates ? { type: "Point", coordinates } : undefined,
  });

const givePet = (owner, name) =>
  Pet.create({
    name,
    breed: "Beagle",
    age: 3,
    weight: 20,
    owner: owner._id,
    creator: owner._id,
  });

const match = (me, pet) =>
  PetMatch.create({
    pet1: pet._id,
    pet2: pet._id,
    matchScore: 80,
    relevantToUser: me._id,
    creator: me._id,
  });

const park = (name, coordinates, placeId) =>
  Location.create({
    name,
    address: `${name} Road`,
    placeId,
    geoLocation: { type: "Point", coordinates },
  });

// --- Pins ------------------------------------------------------------------

test("a matched pet is placed at its owner's position", async () => {
  const me = await signUp("map-me");
  const them = await signUp("map-them", NEARBY);
  const theirPet = await givePet(them, "Bo");
  await match(me, theirPet);

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-me"))
    .expect(200);

  assert.equal(res.body.pets.length, 1);
  // Named, so no screen has to know that the stored pair is [lng, lat].
  assert.equal(res.body.pets[0].latitude, NEARBY[1]);
  assert.equal(res.body.pets[0].longitude, NEARBY[0]);
  assert.equal(res.body.pets[0].name, "Bo");
});

test("the map says how far away each pin is", async () => {
  const me = await signUp("map-dist");
  const them = await signUp("map-dist-them", FAR);
  await match(me, await givePet(them, "Rex"));

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-dist"))
    .expect(200);

  // San Francisco to New York is about 2,570 miles.
  assert.ok(res.body.pets[0].distanceMiles > 2000);
});

test("a pet whose owner has never shared a position is not a pin", async () => {
  const me = await signUp("map-known");
  const them = await signUp("map-unknown", null);
  await match(me, await givePet(them, "Ghost"));

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-known"))
    .expect(200);

  // It still appears in the deck. It just has nowhere to go on a map.
  assert.deepEqual(res.body.pets, []);
});

test("the map reports where you are, for the initial region", async () => {
  await signUp("map-origin");

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-origin"))
    .expect(200);

  assert.deepEqual(res.body.origin, { latitude: HERE[1], longitude: HERE[0] });
});

test("someone you blocked is not on the map", async () => {
  await signUp("map-blocker");
  const them = await signUp("map-blocked", NEARBY);
  const me = await User.findOne({ username: "map-blocker" });
  await match(me, await givePet(them, "Bo"));

  await request(app)
    .post("/api/blocklists")
    .set(...auth("map-blocker"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-blocker"))
    .expect(200);

  // A map is a list of people near you that also says where they are, so
  // forgetting the filter here is worse than forgetting it in the deck.
  assert.deepEqual(res.body.pets, []);
});

test("a suspended account is not on the map", async () => {
  const me = await signUp("map-viewer");
  const them = await signUp("map-suspended", NEARBY);
  await match(me, await givePet(them, "Bo"));
  await User.updateOne({ _id: them._id }, { suspended: true });

  const res = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("map-viewer"))
    .expect(200);

  assert.deepEqual(res.body.pets, []);
});

// --- Places ----------------------------------------------------------------

test("places come back nearest first", async () => {
  await signUp("place-seeker");
  await park("Far Park", FAR, "far");
  await park("Near Park", NEARBY, "near");

  const res = await request(app)
    .get(`/api/locations?lat=${HERE[1]}&lng=${HERE[0]}`)
    .set(...auth("place-seeker"))
    .expect(200);

  assert.equal(res.body[0].name, "Near Park");
  assert.equal(res.body[1].name, "Far Park");
});

test("a range excludes what is outside it", async () => {
  await signUp("place-range");
  await park("Far Park", FAR, "far");
  await park("Near Park", NEARBY, "near");

  const res = await request(app)
    .get(`/api/locations?lat=${HERE[1]}&lng=${HERE[0]}&range=5`)
    .set(...auth("place-range"))
    .expect(200);

  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].name, "Near Park");
});

test("each place says how far away it is", async () => {
  await signUp("place-distance");
  await park("Near Park", NEARBY, "near");

  const res = await request(app)
    .get(`/api/locations?lat=${HERE[1]}&lng=${HERE[0]}`)
    .set(...auth("place-distance"))
    .expect(200);

  assert.ok(res.body[0].distanceMiles >= 0);
  assert.ok(res.body[0].distanceMiles < 2);
});

test("no position asks for everything rather than nothing", async () => {
  await signUp("place-lost");
  await park("Some Park", NEARBY, "some");

  // A list of places somewhere beats an empty screen while a permission
  // prompt is still open.
  const res = await request(app)
    .get("/api/locations")
    .set(...auth("place-lost"))
    .expect(200);

  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].distanceMiles, null);
});

test("the older path still answers, since screens ask for it by name", async () => {
  await signUp("place-legacy");
  await park("Some Park", NEARBY, "some");

  const res = await request(app)
    .get(`/api/locations/playdate-locations?userLat=${HERE[1]}&userLng=${HERE[0]}`)
    .set(...auth("place-legacy"))
    .expect(200);

  assert.equal(res.body.length, 1);
});

test("a place needs a name, an address and a place id", async () => {
  await signUp("place-maker");

  await request(app)
    .post("/api/locations")
    .set(...auth("place-maker"))
    .send({ address: "12 Green Lane", placeId: "p1" })
    .expect(400);
});

test("creating a place stores its coordinates", async () => {
  await signUp("place-coords");

  const res = await request(app)
    .post("/api/locations")
    .set(...auth("place-coords"))
    .send({
      name: "Green Lane Park",
      address: "12 Green Lane",
      placeId: "p-coords",
      coordinates: NEARBY,
    })
    .expect(201);

  assert.deepEqual(res.body.geoLocation.coordinates, NEARBY);
});

test("adding the same place twice returns the one that exists", async () => {
  await signUp("place-twice");
  const body = { name: "Green Lane Park", address: "12 Green Lane", placeId: "p-dup" };

  const first = await request(app)
    .post("/api/locations")
    .set(...auth("place-twice"))
    .send(body)
    .expect(201);

  const second = await request(app)
    .post("/api/locations")
    .set(...auth("place-twice"))
    .send(body)
    .expect(200);

  // The unique index is what stops an import filling the map with the same
  // park five times; a duplicate is not a failure worth showing anybody.
  assert.equal(String(first.body._id), String(second.body._id));
  assert.equal(await Location.countDocuments({}), 1);
});

// --- Importing -------------------------------------------------------------

test("importing reports 503 when Google is not configured", async () => {
  await signUp("importer");

  // Optional in the same way Stripe is: a missing key must never look like a
  // bug, and must never stop the rest of the map working.
  assert.equal(places.isEnabled(), false);

  await request(app)
    .post(`/api/locations/import?lat=${HERE[1]}&lng=${HERE[0]}`)
    .set(...auth("importer"))
    .expect(503);
});

test("importing needs a position", async () => {
  await signUp("importer-lost");
  process.env.GOOGLE_MAPS_API_KEY = "test-key";

  await request(app)
    .post("/api/locations/import")
    .set(...auth("importer-lost"))
    .expect(400);
});

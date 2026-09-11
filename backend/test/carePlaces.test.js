const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const { categoriesFor, CARE_CATEGORIES } = require("../services/placeCategories");

let app;
let User;
let Location;

/**
 * The care hub's places: vets, shops, groomers and boarders.
 *
 * These used to have a model of their own - `Service`, a stub with a String
 * address, no coordinates and a create route any signed-in account could post
 * to. Nothing called it, while the importer had been pulling `veterinary_care`
 * and `pet_store` into `Location` all along. So the directory already existed
 * in the model with the geo index and the unique `placeId`; what it lacked was
 * any way to tell a vet from a park.
 *
 * The rows these tests write have no `geoLocation`, which exercises the
 * fallback path deliberately: somebody who has not shared a position gets a
 * list of places rather than an empty screen.
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
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });

const makePlace = (name, categories, extra = {}) =>
  Location.create({
    name,
    address: `${name} Street`,
    placeId: `place-${name.toLowerCase().replace(/\s+/g, "-")}`,
    categories,
    ...extra,
  });

// --- Categorising -----------------------------------------------------------

test("a groomer is recognised from the search, not from Google's types", async () => {
  // Google has no grooming type, so a groomer comes back typed `pet_store`.
  // Without the category the search was for there is no way to tell it apart
  // from a shop - which is why `category` is carried through the search.
  assert.deepEqual(categoriesFor(["pet_store", "establishment"], "groomer"), [
    "petStore",
    "groomer",
  ]);
});

test("a place can hold more than one category", async () => {
  // Plenty of vets board. Forcing one answer would hide half of them.
  assert.deepEqual(categoriesFor(["veterinary_care"], "boarding"), ["vet", "boarding"]);
});

test("an unrecognised place gets no categories rather than a guess", async () => {
  assert.deepEqual(categoriesFor(["restaurant", "establishment"], null), []);
});

// --- The list ---------------------------------------------------------------

test("the care list holds care places and never parks", async () => {
  await makeUser("care-viewer");
  await makePlace("Central Park", ["park"]);
  await makePlace("Averill Vets", ["vet"]);
  await makePlace("Paws Grooming", ["petStore", "groomer"]);

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("care-viewer"))
    .expect(200);

  assert.deepEqual(
    res.body.places.map((place) => place.name).sort(),
    ["Averill Vets", "Paws Grooming"]
  );
});

test("the care list can be narrowed to one category", async () => {
  await makeUser("narrow-viewer");
  await makePlace("Averill Vets", ["vet"]);
  await makePlace("Paws Grooming", ["groomer"]);

  const res = await request(app)
    .get("/api/locations/care?category=vet")
    .set(...auth("narrow-viewer"))
    .expect(200);

  assert.deepEqual(
    res.body.places.map((place) => place.name),
    ["Averill Vets"]
  );
});

test("a misspelled category returns nothing, never everything", async () => {
  // The one wrong answer worse than an empty list: falling back to "no filter"
  // and serving parks to somebody who asked for vets.
  await makeUser("typo-viewer");
  await makePlace("Central Park", ["park"]);
  await makePlace("Averill Vets", ["vet"]);

  const res = await request(app)
    .get("/api/locations/care?category=vetrinary")
    .set(...auth("typo-viewer"))
    .expect(200);

  assert.deepEqual(res.body.places, []);
});

test("an uncategorised row is not served as a vet", async () => {
  // Rows imported before `categories` existed have none. A place whose kind we
  // do not know is not evidence of a vet.
  await makeUser("legacy-viewer");
  await makePlace("Unknown Place", undefined);

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("legacy-viewer"))
    .expect(200);

  assert.deepEqual(res.body.places, []);
});

test("the map's own list still returns everything when unfiltered", async () => {
  // The playdate pickers call this and must keep working untouched, including
  // for rows imported before categories existed.
  await makeUser("map-viewer");
  await makePlace("Central Park", ["park"]);
  await makePlace("Averill Vets", ["vet"]);
  await makePlace("Unknown Place", undefined);

  const res = await request(app)
    .get("/api/locations")
    .set(...auth("map-viewer"))
    .expect(200);

  assert.equal(res.body.length, 3);
});

test("the map's list narrows to parks when asked", async () => {
  await makeUser("park-viewer");
  await makePlace("Central Park", ["park"]);
  await makePlace("Averill Vets", ["vet"]);

  const res = await request(app)
    .get("/api/locations?category=park")
    .set(...auth("park-viewer"))
    .expect(200);

  assert.deepEqual(
    res.body.map((place) => place.name),
    ["Central Park"]
  );
});

// --- Emergency --------------------------------------------------------------

test("the emergency numbers are there with no location and no rows", async () => {
  // The half of the hub that must work on a fresh deployment with no Google
  // key, and the half somebody needs most urgently.
  await makeUser("emergency-viewer");

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("emergency-viewer"))
    .expect(200);

  assert.deepEqual(res.body.places, []);
  assert.ok(res.body.emergency.length > 0);
  for (const contact of res.body.emergency) {
    assert.ok(contact.name);
    assert.ok(contact.phone);
    // These are US and Canada services and the app never asks where anybody
    // lives, so every entry has to say who it is for.
    assert.ok(contact.region);
  }
});

test("the list says whether it knows where you are", async () => {
  await makeUser("origin-viewer");

  const without = await request(app)
    .get("/api/locations/care")
    .set(...auth("origin-viewer"))
    .expect(200);
  assert.equal(without.locationKnown, undefined);
  assert.equal(without.body.locationKnown, false);

  const withPosition = await request(app)
    .get("/api/locations/care?lat=37.76&lng=-122.43")
    .set(...auth("origin-viewer"))
    .expect(200);
  assert.equal(withPosition.body.locationKnown, true);
});

test("distance is attached in miles when both ends are known", async () => {
  await makeUser("distance-viewer");
  await makePlace("Averill Vets", ["vet"], {
    geoLocation: { type: "Point", coordinates: [-122.43, 37.77] },
  });

  const res = await request(app)
    .get("/api/locations/care?lat=37.76&lng=-122.43")
    .set(...auth("distance-viewer"))
    .expect(200);

  assert.equal(res.body.places.length, 1);
  assert.equal(typeof res.body.places[0].distanceMiles, "number");
  assert.ok(res.body.places[0].distanceMiles < 2);
});

// --- The shape of it --------------------------------------------------------

test("a patio is a category only when asked for, never in the default care list", async () => {
  const { OUT_CATEGORIES, IMPORTS } = require("../services/placeCategories");
  // Every out-and-about category is a keyword search: Google has no
  // dog-friendly type, and the row must carry the category it was searched for.
  for (const category of OUT_CATEGORIES) {
    const entry = IMPORTS.find((candidate) => candidate.category === category);
    assert.ok(entry?.keyword, `${category} needs a keyword search`);
  }
  assert.deepEqual(categoriesFor(["restaurant", "establishment"], "patio"), ["patio"]);
  assert.ok(!CARE_CATEGORIES.some((category) => OUT_CATEGORIES.includes(category)));
});

test("care categories never include parks", () => {
  // A hub listing the local park under "places to take your pet for care"
  // would be a category error with a real consequence: it pads the vet list.
  assert.ok(!CARE_CATEGORIES.includes("park"));
});

// --- Saved places -----------------------------------------------------------

test("an owner can save a place and gets it back with the list", async () => {
  const owner = await makeUser("save-owner");
  assert.ok(owner);
  const vet = await makePlace("My Vet", ["vet"]);

  await request(app)
    .post("/api/favorites/places")
    .set(...auth("save-owner"))
    .send({ locationId: vet._id })
    .expect(201);

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("save-owner"))
    .expect(200);

  assert.deepEqual(
    res.body.saved.map((place) => place.name),
    ["My Vet"]
  );
});

test("a saved place survives a category filter that excludes it", async () => {
  // Your own vet is the entry you came here to find; it must not vanish
  // because you tapped the "Groomers" chip.
  await makeUser("filter-owner");
  const vet = await makePlace("My Vet", ["vet"]);

  await request(app)
    .post("/api/favorites/places")
    .set(...auth("filter-owner"))
    .send({ locationId: vet._id })
    .expect(201);

  const res = await request(app)
    .get("/api/locations/care?category=groomer")
    .set(...auth("filter-owner"))
    .expect(200);

  assert.deepEqual(res.body.places, []);
  assert.equal(res.body.saved.length, 1);
});

test("saving twice is a double tap, not an error", async () => {
  await makeUser("twice-owner");
  const vet = await makePlace("My Vet", ["vet"]);

  for (let i = 0; i < 2; i += 1) {
    await request(app)
      .post("/api/favorites/places")
      .set(...auth("twice-owner"))
      .send({ locationId: vet._id })
      .expect(201);
  }

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("twice-owner"))
    .expect(200);

  assert.equal(res.body.saved.length, 1);
});

test("unsaving is idempotent", async () => {
  await makeUser("unsave-owner");
  const vet = await makePlace("My Vet", ["vet"]);

  await request(app)
    .post("/api/favorites/places")
    .set(...auth("unsave-owner"))
    .send({ locationId: vet._id })
    .expect(201);

  const first = await request(app)
    .delete(`/api/favorites/place/${vet._id}`)
    .set(...auth("unsave-owner"))
    .expect(200);
  const second = await request(app)
    .delete(`/api/favorites/place/${vet._id}`)
    .set(...auth("unsave-owner"))
    .expect(200);

  assert.equal(first.body.removed, true);
  assert.equal(second.body.removed, false);
});

test("you never see somebody else's saved places", async () => {
  await makeUser("mine-owner");
  await makeUser("theirs-owner");
  const vet = await makePlace("Their Vet", ["vet"]);

  await request(app)
    .post("/api/favorites/places")
    .set(...auth("theirs-owner"))
    .send({ locationId: vet._id })
    .expect(201);

  const res = await request(app)
    .get("/api/locations/care")
    .set(...auth("mine-owner"))
    .expect(200);

  assert.deepEqual(res.body.saved, []);
});

test("a favourite is of a pet or a place, never both and never neither", async () => {
  // Each `required` excuses the other, so without this validator a row with
  // neither target would save and be rendered by nothing.
  const Favorite = require("../models/Favorite");
  const owner = await makeUser("validator-owner");

  await assert.rejects(
    Favorite.create({ user: owner._id, creator: owner._id }),
    /not both and not neither/
  );
});

test("Service is gone rather than left mounted", async () => {
  await makeUser("gone-viewer");

  // A user-writable "directory of vets" nothing called. Deleted the way
  // PotentialPlaydateLocation was, rather than kept in step.
  await request(app)
    .get("/api/services")
    .set(...auth("gone-viewer"))
    .expect(404);
});

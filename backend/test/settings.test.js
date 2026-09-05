const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const settings = require("../services/settings");
const { isQuiet, localMinutes } = require("../services/quietHours");

let app;
let User;

/**
 * Settings, and the promise that each of them does something.
 *
 * They used to be three shapes that disagreed: `updateUserSettings` took three
 * named fields and wrote all three on every call, so a client sending only
 * `playdateRange` also overwrote `notificationsEnabled` and
 * `locationSharingEnabled` - and the app's Privacy screen had two toggles that
 * persisted nowhere at all, one of which duplicated a toggle on the Settings
 * screen that did save.
 *
 * `settingsEnforcement.test.js` next door proves the stored values change what
 * the API does. This file is about the writing of them.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeUser = (uid = "owner") =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

test("a partial patch touches only what it names", () => {
  const update = settings.updateFor({ privacy: { showOnMap: false } }, {});

  // Flat dotted paths, not a nested object: `$set: { privacy: {...} }` would
  // replace the whole subdocument and drop every other privacy setting.
  assert.deepEqual(update, { "privacy.showOnMap": false });
});

test("a setting that does not exist is refused, not ignored", () => {
  assert.throws(
    () => settings.updateFor({ privacy: { telepathy: true } }, {}),
    /privacy.telepathy is not a setting/
  );
  assert.throws(() => settings.updateFor({ isAdmin: true }, {}), /is not a setting/);
});

test("a value of the wrong type is refused", () => {
  assert.throws(() => settings.updateFor({ privacy: { showOnMap: "yes" } }, {}), /true or false/);
  assert.throws(() => settings.updateFor({ playdateRange: "far" }, {}), /must be a number/);
  assert.throws(
    () => settings.updateFor({ privacy: { messagesFrom: "pals" } }, {}),
    /must be one of/
  );
});

test("a number outside its range is refused", () => {
  assert.throws(() => settings.updateFor({ playdateRange: 900 }, {}), /between 0 and 500/);
  assert.throws(
    () => settings.updateFor({ discovery: { minAge: 2.5 } }, {}),
    /whole number/
  );
});

test("a minimum above its maximum is refused rather than stored", () => {
  // An impossible range matches nothing, and an empty deck looks exactly like
  // a broken one.
  assert.throws(
    () => settings.updateFor({ discovery: { minWeight: 50, maxWeight: 10 } }, {}),
    /cannot be above/
  );
  assert.throws(
    () => settings.updateFor({ discovery: { minAge: 9 } }, { discovery: { maxAge: 4 } }),
    /cannot be above/
  );
});

test("the range check reads the stored value for whichever half is absent", () => {
  // Raising only the minimum has to be checked against the maximum already
  // saved, not against the default.
  assert.doesNotThrow(() =>
    settings.updateFor({ discovery: { minWeight: 20 } }, { discovery: { maxWeight: 80 } })
  );
});

test("a species list is deduped and checked", () => {
  assert.deepEqual(
    settings.updateFor({ discovery: { species: ["dog", "dog", "cat"] } }, {}),
    { "discovery.species": ["dog", "cat"] }
  );
  assert.throws(
    () => settings.updateFor({ discovery: { species: ["dragon"] } }, {}),
    /cannot include dragon/
  );
});

test("defaults fill in what a document has never set", () => {
  const filled = settings.withDefaults({});

  assert.equal(filled.privacy.messagesFrom, "everyone");
  assert.equal(filled.units.distance, "mi");
  assert.equal(filled.discovery.includeUnknownDistance, true);
});

// ---------------------------------------------------------------------------
// The endpoint
// ---------------------------------------------------------------------------

test("settings come back with every default filled in", async () => {
  await makeUser();

  const response = await request(app)
    .get("/api/users/me/settings")
    .set(...auth("owner"))
    .expect(200);

  assert.equal(response.body.privacy.profileVisibility, "everyone");
  assert.equal(response.body.units.weight, "lb");
  // The screen builds its pickers from these rather than hardcoding a list
  // that can drift from the validator.
  assert.ok(response.body.choices.audiences.includes("friends"));
  assert.ok(response.body.choices.species.includes("dog"));
});

test("a patch saves and comes back", async () => {
  await makeUser();

  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ units: { distance: "km" }, privacy: { showOnMap: false } })
    .expect(200);

  const response = await request(app)
    .get("/api/users/me/settings")
    .set(...auth("owner"))
    .expect(200);

  assert.equal(response.body.units.distance, "km");
  assert.equal(response.body.privacy.showOnMap, false);
});

test("saving one setting does not overwrite its siblings", async () => {
  await makeUser();

  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ privacy: { messagesFrom: "friends", showOnMap: false } })
    .expect(200);

  // This is the bug the old three-field update had, one level down: a `$set`
  // of a nested object replaces the whole subdocument.
  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ privacy: { discoverableInSearch: false } })
    .expect(200);

  const response = await request(app)
    .get("/api/users/me/settings")
    .set(...auth("owner"));

  assert.equal(response.body.privacy.messagesFrom, "friends");
  assert.equal(response.body.privacy.showOnMap, false);
  assert.equal(response.body.privacy.discoverableInSearch, false);
});

test("sending only one field leaves the others alone", async () => {
  await makeUser();

  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ locationSharingEnabled: false, notificationsEnabled: false })
    .expect(200);

  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ playdateRange: 40 })
    .expect(200);

  const response = await request(app)
    .get("/api/users/me/settings")
    .set(...auth("owner"));

  // The old handler wrote all three every time, so this used to set both of
  // these back to `undefined`.
  assert.equal(response.body.playdateRange, 40);
  assert.equal(response.body.locationSharingEnabled, false);
  assert.equal(response.body.notificationsEnabled, false);
});

test("an invalid patch is a 400 that says which setting", async () => {
  await makeUser();

  const response = await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("owner"))
    .send({ discovery: { maxAge: 99 } })
    .expect(400);

  assert.match(response.body.message, /discovery.maxAge/);
  assert.equal(response.body.code, "INVALID_SETTING");
});

test("an older client's range string is converted rather than rejected", async () => {
  await makeUser();

  await request(app)
    .post("/api/users/settings")
    .set(...auth("owner"))
    .send({ playdateRange: "Within 20 miles" })
    .expect(200);

  const response = await request(app)
    .get("/api/users/me/settings")
    .set(...auth("owner"));

  assert.equal(response.body.playdateRange, 20);
});

test("settings are the caller's own, never another account's", async () => {
  await makeUser("owner");
  await makeUser("stranger");

  await request(app)
    .patch("/api/users/me/settings")
    .set(...auth("stranger"))
    .send({ units: { weight: "kg" } })
    .expect(200);

  const owner = await User.findOne({ firebaseUid: "owner" }).lean();
  assert.notEqual(owner.units?.weight, "kg");
});

// ---------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------

/**
 * The window that wraps midnight is the whole point.
 *
 * "22:00 to 07:00" is the setting everybody picks, and a naive
 * `start <= now && now <= end` gets it exactly backwards - silencing the nine
 * hours somebody is awake and letting every push through while they sleep.
 */
const at = (hhmm) => new Date(`2026-05-01T${hhmm}:00.000Z`);

test("a window that wraps midnight silences the night, not the day", () => {
  const quiet = { enabled: true, start: "22:00", end: "07:00", utcOffsetMinutes: 0 };

  assert.equal(isQuiet(quiet, at("23:30")), true);
  assert.equal(isQuiet(quiet, at("03:00")), true);
  assert.equal(isQuiet(quiet, at("06:59")), true);
  assert.equal(isQuiet(quiet, at("07:00")), false);
  assert.equal(isQuiet(quiet, at("14:00")), false);
  assert.equal(isQuiet(quiet, at("21:59")), false);
});

test("a window inside one day works too", () => {
  const quiet = { enabled: true, start: "09:00", end: "17:00", utcOffsetMinutes: 0 };

  assert.equal(isQuiet(quiet, at("12:00")), true);
  assert.equal(isQuiet(quiet, at("08:59")), false);
  assert.equal(isQuiet(quiet, at("17:00")), false);
});

test("the window is wall-clock in the user's own zone", () => {
  // 03:00 UTC is 22:00 the previous evening in UTC-5, which is inside a
  // 22:00-07:00 window. A stored instant would have got this wrong.
  const quiet = { enabled: true, start: "22:00", end: "07:00", utcOffsetMinutes: -300 };

  assert.equal(isQuiet(quiet, at("03:00")), true);
  assert.equal(isQuiet(quiet, at("18:00")), false);
});

test("local minutes wrap correctly either side of midnight", () => {
  assert.equal(localMinutes(at("00:30"), -60), 23 * 60 + 30);
  assert.equal(localMinutes(at("23:30"), 60), 30);
});

test("quiet hours off, or malformed, never silence anything", () => {
  assert.equal(isQuiet({ enabled: false, start: "22:00", end: "07:00" }, at("23:00")), false);
  assert.equal(isQuiet(undefined, at("23:00")), false);
  assert.equal(isQuiet({ enabled: true, start: "nope", end: "07:00" }, at("23:00")), false);
  // Start equal to end is far more likely a half-finished setting than a
  // request never to be told anything again.
  assert.equal(isQuiet({ enabled: true, start: "22:00", end: "22:00" }, at("23:00")), false);
});

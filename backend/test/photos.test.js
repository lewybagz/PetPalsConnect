const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const {
  PHOTO_LIMIT,
  isStoredPhoto,
  sanitisePhotos,
  sanitisePhoto,
} = require("../services/photos");
const harness = require("./helpers/harness");

const OURS = "https://firebasestorage.googleapis.com/v0/b/petpals/o/pets%2Fabc.jpg?alt=media";
const ALSO_OURS = "https://storage.googleapis.com/petpals/pets/def.jpg";

/**
 * What may end up in a `photos` array.
 *
 * Nothing validated these. `photos` was written straight from the request body
 * and rendered by every screen in the app, so a client could store any URL -
 * an arbitrary host, a `javascript:` string, a thousand entries - and every
 * other user's device would fetch it.
 */

test("a URL from our storage bucket is accepted", () => {
  assert.ok(isStoredPhoto(OURS));
  assert.ok(isStoredPhoto(ALSO_OURS));
});

test("a URL from anywhere else is not", () => {
  assert.ok(!isStoredPhoto("https://example.com/dog.jpg"));
  assert.ok(!isStoredPhoto("https://firebasestorage.googleapis.com.evil.test/x.jpg"));
});

test("a non-https scheme is refused", () => {
  // These render as an image source on somebody else's device.
  assert.ok(!isStoredPhoto("javascript:alert(1)"));
  assert.ok(!isStoredPhoto("data:image/png;base64,AAAA"));
  assert.ok(!isStoredPhoto("http://firebasestorage.googleapis.com/x.jpg"));
});

test("nonsense is refused rather than throwing", () => {
  assert.ok(!isStoredPhoto(null));
  assert.ok(!isStoredPhoto(42));
  assert.ok(!isStoredPhoto("not a url at all"));
  assert.ok(!isStoredPhoto(`https://firebasestorage.googleapis.com/${"x".repeat(3000)}`));
});

test("a list keeps only ours, in order", () => {
  const clean = sanitisePhotos([OURS, "https://example.com/a.jpg", ALSO_OURS]);
  assert.deepEqual(clean, [OURS, ALSO_OURS]);
});

test("duplicates are dropped", () => {
  assert.deepEqual(sanitisePhotos([OURS, OURS]), [OURS]);
});

test("the list is capped", () => {
  const many = Array.from(
    { length: 50 },
    (_, index) => `https://storage.googleapis.com/petpals/pets/${index}.jpg`
  );

  assert.equal(sanitisePhotos(many).length, PHOTO_LIMIT);
});

test("anything that is not a list becomes an empty one", () => {
  assert.deepEqual(sanitisePhotos(undefined), []);
  assert.deepEqual(sanitisePhotos("https://storage.googleapis.com/x.jpg"), []);
});

test("a single photo field is validated the same way", () => {
  assert.equal(sanitisePhoto(OURS), OURS);
  assert.equal(sanitisePhoto("https://example.com/me.jpg"), undefined);
});

// --- Through the API --------------------------------------------------------

let app;
let User;
let Pet;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });

const petBody = (photos) => ({
  name: "Bo",
  breed: "Beagle",
  age: 3,
  weight: 20,
  photos,
});

test("a pet keeps only photos we stored", async () => {
  await signUp("photo-owner");

  const res = await request(app)
    .post("/api/pets")
    .set(...auth("photo-owner"))
    .send(petBody([OURS, "https://example.com/not-ours.jpg"]))
    .expect(201);

  assert.deepEqual(res.body.pet.photos, [OURS]);
});

test("a pet cannot be created with a javascript: photo", async () => {
  await signUp("xss-owner");

  const res = await request(app)
    .post("/api/pets")
    .set(...auth("xss-owner"))
    .send(petBody(["javascript:alert(1)"]))
    .expect(201);

  assert.deepEqual(res.body.pet.photos, []);
});

test("updating a pet validates photos too", async () => {
  const owner = await signUp("update-owner");
  const pet = await Pet.create({
    name: "Bo",
    breed: "Beagle",
    age: 3,
    weight: 20,
    owner: owner._id,
    creator: owner._id,
  });

  await request(app)
    .put(`/api/pets/${pet._id}`)
    .set(...auth("update-owner"))
    .send({ photos: [OURS, "https://example.com/sneaky.jpg"] })
    .expect(200);

  const stored = await Pet.findById(pet._id).lean();
  assert.deepEqual(stored.photos, [OURS]);
});

test("a profile photo from somewhere else is refused", async () => {
  const user = await signUp("avatar-owner");

  const res = await request(app)
    .patch(`/api/users/${user._id}`)
    .set(...auth("avatar-owner"))
    .send({ userPhoto: "https://example.com/me.jpg" });

  assert.equal(res.status, 400);

  const stored = await User.findById(user._id).lean();
  assert.equal(stored.userPhoto, undefined);
});

test("a profile photo we stored is kept", async () => {
  const user = await signUp("avatar-ok");

  await request(app)
    .patch(`/api/users/${user._id}`)
    .set(...auth("avatar-ok"))
    .send({ userPhoto: OURS })
    .expect(200);

  const stored = await User.findById(user._id).lean();
  assert.equal(stored.userPhoto, OURS);
});

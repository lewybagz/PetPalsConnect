const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

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

/** Creates a signed-up user and returns [authHeader, userDoc]. */
const signUp = async (uid, username) => {
  const user = await User.create({
    firebaseUid: uid,
    username,
    email: `${uid}@example.test`,
  });
  return [auth(uid), user];
};

const MINIMAL_PET = { name: "Rex", breed: "Labrador", age: 3, weight: 25 };

test("a pet can be created with exactly the fields onboarding asks for", async () => {
  const [header] = await signUp("pet-owner", "petowner");

  const res = await request(app)
    .post("/api/pets")
    .set(...header)
    .send(MINIMAL_PET);

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.pet.name, "Rex");
  // `title` is required on the shared Content schema; deriving it from the name
  // is what makes a minimal create possible at all.
  assert.equal(res.body.pet.title, "Rex");
});

test("a new pet is linked to its owner's profile", async () => {
  const [header, user] = await signUp("linking-owner", "linkingowner");

  const res = await request(app)
    .post("/api/pets")
    .set(...header)
    .send(MINIMAL_PET)
    .expect(201);

  // Without this link the app can never tell that a user has a pet, so the
  // onboarding gate would never open.
  const updated = await User.findById(user._id).lean();
  assert.equal(updated.pets.length, 1);
  assert.equal(String(updated.pets[0]), res.body.pet._id);
});

test("ownership comes from the token, not the request body", async () => {
  const [, victim] = await signUp("victim", "victimuser");
  const [attackerHeader, attacker] = await signUp("attacker", "attackeruser");

  const res = await request(app)
    .post("/api/pets")
    .set(...attackerHeader)
    .send({ ...MINIMAL_PET, owner: victim._id, creator: victim._id })
    .expect(201);

  assert.equal(String(res.body.pet.owner), String(attacker._id));

  const victimDoc = await User.findById(victim._id).lean();
  assert.equal(victimDoc.pets.length, 0, "a pet was planted on another account");
});

test("creating a pet without a profile is refused rather than orphaning it", async () => {
  const res = await request(app)
    .post("/api/pets")
    .set(...auth("no-profile"))
    .send(MINIMAL_PET);

  assert.equal(res.status, 404);
  assert.equal(await Pet.countDocuments(), 0);
});

test("a pet missing required details is a 400, not a 500", async () => {
  const [header] = await signUp("bad-input", "badinput");

  const res = await request(app)
    .post("/api/pets")
    .set(...header)
    .send({ breed: "Labrador" });

  assert.equal(res.status, 400);
});

test("the owner's pets come back from /api/users/me", async () => {
  const [header] = await signUp("me-pets", "mepets");

  await request(app).post("/api/pets").set(...header).send(MINIMAL_PET).expect(201);

  const res = await request(app).get("/api/users/me").set(...header);

  assert.equal(res.status, 200);
  assert.equal(res.body.pets.length, 1);
  assert.equal(res.body.pets[0].name, "Rex");
});

test("a pet can be fetched by id", async () => {
  const [header] = await signUp("fetcher", "fetcheruser");
  const created = await request(app)
    .post("/api/pets")
    .set(...header)
    .send(MINIMAL_PET)
    .expect(201);

  // The route declares "/:petId"; reading req.params.id here always missed.
  const res = await request(app)
    .get(`/api/pets/${created.body.pet._id}`)
    .set(...header);

  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Rex");
});

test("updating a pet applies every editable field, not just the name", async () => {
  const [header] = await signUp("updater", "updateruser");
  const created = await request(app)
    .post("/api/pets")
    .set(...header)
    .send(MINIMAL_PET)
    .expect(201);

  const res = await request(app)
    .put(`/api/pets/${created.body.pet._id}`)
    .set(...header)
    .send({ name: "Rexy", weight: 28, temperament: "Friendly" });

  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Rexy");
  assert.equal(res.body.weight, 28);
  assert.equal(res.body.temperament, "Friendly");
});

test("you cannot update someone else's pet", async () => {
  const [ownerHeader] = await signUp("real-owner", "realowner");
  const [otherHeader] = await signUp("other-user", "otheruser");

  const created = await request(app)
    .post("/api/pets")
    .set(...ownerHeader)
    .send(MINIMAL_PET)
    .expect(201);

  const res = await request(app)
    .put(`/api/pets/${created.body.pet._id}`)
    .set(...otherHeader)
    .send({ name: "Stolen" });

  assert.equal(res.status, 403);
});

test("deleting a pet removes it and unlinks it from the profile", async () => {
  const [header, user] = await signUp("deleter", "deleteruser");
  const created = await request(app)
    .post("/api/pets")
    .set(...header)
    .send(MINIMAL_PET)
    .expect(201);

  const res = await request(app)
    .delete(`/api/pets/${created.body.pet._id}`)
    .set(...header);

  assert.equal(res.status, 200);
  assert.equal(await Pet.countDocuments(), 0);

  const updated = await User.findById(user._id).lean();
  assert.equal(updated.pets.length, 0);
});

test("you cannot delete someone else's pet", async () => {
  const [ownerHeader] = await signUp("keep-owner", "keepowner");
  const [otherHeader] = await signUp("thief", "thiefuser");

  const created = await request(app)
    .post("/api/pets")
    .set(...ownerHeader)
    .send(MINIMAL_PET)
    .expect(201);

  const res = await request(app)
    .delete(`/api/pets/${created.body.pet._id}`)
    .set(...otherHeader);

  assert.equal(res.status, 403);
  assert.equal(await Pet.countDocuments(), 1);
});

test("adding a second pet keeps the first", async () => {
  const [header, user] = await signUp("multi-pet", "multipet");

  await request(app).post("/api/pets").set(...header).send(MINIMAL_PET).expect(201);
  await request(app)
    .post("/api/pets")
    .set(...header)
    .send({ name: "Bella", breed: "Beagle", age: 2, weight: 18 })
    .expect(201);

  const updated = await User.findById(user._id).lean();
  assert.equal(updated.pets.length, 2);
});

test("weight is required - matching depends on it", async () => {
  const [header] = await signUp("no-weight", "noweight");

  const res = await request(app)
    .post("/api/pets")
    .set(...header)
    .send({ name: "Rex", breed: "Labrador", age: 3 });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /weight/i);
  assert.equal(await Pet.countDocuments(), 0);
});

test("a negative weight is refused", async () => {
  const [header] = await signUp("bad-weight", "badweight");

  const res = await request(app)
    .post("/api/pets")
    .set(...header)
    .send({ ...MINIMAL_PET, weight: -5 });

  assert.equal(res.status, 400);
});

// --- Matching integration -------------------------------------------------

test("creating a pet produces stored matches against compatible pets", async () => {
  const [aHeader] = await signUp("matcher-a", "matchera");
  const [bHeader] = await signUp("matcher-b", "matcherb");

  await request(app).post("/api/pets").set(...aHeader).send(MINIMAL_PET).expect(201);

  const second = await request(app)
    .post("/api/pets")
    .set(...bHeader)
    .send({ name: "Bella", breed: "Labrador", age: 3, weight: 26 })
    .expect(201);

  assert.ok(Array.isArray(second.body.matches));
  assert.ok(second.body.matches.length > 0, "two similar Labradors should match");
  assert.ok(second.body.matches[0].breakdown, "a match should explain itself");
});

test("re-running matching does not duplicate stored matches", async () => {
  const PetMatch = require("../models/PetMatch");
  const [aHeader] = await signUp("dedupe-a", "dedupea");
  const [bHeader] = await signUp("dedupe-b", "dedupeb");

  await request(app).post("/api/pets").set(...aHeader).send(MINIMAL_PET).expect(201);
  const mine = await request(app)
    .post("/api/pets")
    .set(...bHeader)
    .send({ name: "Bella", breed: "Labrador", age: 3, weight: 26 })
    .expect(201);

  const afterFirst = await PetMatch.countDocuments();

  // The old implementation inserted a fresh document on every run.
  await request(app)
    .post("/api/petmatches/match")
    .set(...bHeader)
    .send({ petId: mine.body.pet._id })
    .expect(200);

  assert.equal(await PetMatch.countDocuments(), afterFirst);
});

test("you cannot run matching for someone else's pet", async () => {
  const [ownerHeader] = await signUp("match-owner", "matchowner");
  const [otherHeader] = await signUp("match-other", "matchother");

  const created = await request(app)
    .post("/api/pets")
    .set(...ownerHeader)
    .send(MINIMAL_PET)
    .expect(201);

  const res = await request(app)
    .post("/api/petmatches/match")
    .set(...otherHeader)
    .send({ petId: created.body.pet._id });

  assert.equal(res.status, 403);
});

test("matching runs without a petId are refused", async () => {
  const [header] = await signUp("no-petid", "nopetid");
  const res = await request(app).post("/api/petmatches/match").set(...header).send({});
  assert.equal(res.status, 400);
});

test("two pets can be compared with an explanation", async () => {
  const [aHeader] = await signUp("explain-a", "explaina");
  const [bHeader] = await signUp("explain-b", "explainb");

  const first = await request(app).post("/api/pets").set(...aHeader).send(MINIMAL_PET).expect(201);
  const second = await request(app)
    .post("/api/pets")
    .set(...bHeader)
    .send({ name: "Tiny", breed: "Chihuahua", age: 12, weight: 5 })
    .expect(201);

  const res = await request(app)
    .get(`/api/petmatches/explain/${first.body.pet._id}/${second.body.pet._id}`)
    .set(...aHeader);

  assert.equal(res.status, 200);
  assert.ok(typeof res.body.score === "number");
  // A 25lb Labrador and a 5lb Chihuahua should not score on size.
  assert.equal(res.body.breakdown.size, 0);
});

test("a pet's owner sees their matches", async () => {
  const [aHeader] = await signUp("sees-a", "seesa");
  const [bHeader] = await signUp("sees-b", "seesb");

  await request(app).post("/api/pets").set(...aHeader).send(MINIMAL_PET).expect(201);
  await request(app)
    .post("/api/pets")
    .set(...bHeader)
    .send({ name: "Bella", breed: "Labrador", age: 3, weight: 26 })
    .expect(201);

  const res = await request(app).get("/api/petmatches/matched-pets").set(...bHeader);

  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
});

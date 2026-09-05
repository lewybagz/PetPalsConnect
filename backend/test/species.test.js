const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let PetDecision;

/**
 * Species: profiles hold any animal, playdates are dogs only.
 *
 * A profile can now hold a cat, a rabbit or a bearded dragon so the care hub
 * has something to recommend food, supplies and a vet from. Matching cannot
 * follow it there - `compatibility.js` scores size, temperament and activity
 * in dog terms, and a cat in the deck is a bug with a very confused user at
 * the end of it.
 *
 * The rule therefore has to hold in three separate places, and these cover all
 * three: the deck a person browses, the matcher that runs when a pet is
 * created, and the decision endpoint a hand-made request could reach directly.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  PetDecision = require("../models/PetDecision");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwner = (uid) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });

const givePet = async (user, overrides = {}) => {
  const pet = await Pet.create({
    name: `${user.username}-pet`,
    species: "dog",
    weight: 30,
    breed: "Labrador",
    age: 3,
    owner: user._id,
    creator: user._id,
    ...overrides,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return pet;
};

// --- The schema -------------------------------------------------------------

test("a pet stored without a species is a dog", async () => {
  const owner = await makeOwner("default-species");
  const pet = await givePet(owner, { species: undefined });

  assert.equal(pet.species, "dog");
});

test("a cat needs a breed and a weight, a fish needs neither", async () => {
  const owner = await makeOwner("conditional-fields");

  // Breed and weight drive size scoring and portioning; a fish has neither in
  // any sense the app can use, and requiring them would make adding one an
  // exercise in inventing numbers.
  const fish = await Pet.create({
    name: "Bubbles",
    species: "fish",
    age: 1,
    owner: owner._id,
    creator: owner._id,
  });
  assert.equal(fish.species, "fish");
  assert.equal(fish.weight, undefined);

  await assert.rejects(
    Pet.create({
      name: "Mog",
      species: "cat",
      age: 4,
      owner: owner._id,
      creator: owner._id,
    }),
    /breed|weight/i
  );
});

test("an unknown species is refused rather than stored", async () => {
  const owner = await makeOwner("bad-species");

  await assert.rejects(
    Pet.create({
      name: "Rex",
      species: "dinosaur",
      age: 3,
      owner: owner._id,
      creator: owner._id,
    }),
    /species/i
  );
});

// --- The deck ---------------------------------------------------------------

test("a cat is never a candidate in somebody's deck", async () => {
  const me = await makeOwner("deck-me");
  await givePet(me);

  const them = await makeOwner("deck-them");
  await givePet(them, { name: "Mog", species: "cat", breed: "Tabby", weight: 9 });

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("deck-me"))
    .expect(200);

  assert.deepEqual(res.body.candidates, []);
});

test("an owner whose only pet is a cat gets the preview, not an empty deck", async () => {
  // The important half: they must not be handed a deck built around a cat, and
  // they must not be handed nothing. Preview is exactly right for them - the
  // same dogs, no scoring, and a prompt that names what a dog would unlock.
  const me = await makeOwner("cat-only");
  await givePet(me, { name: "Mog", species: "cat", breed: "Tabby", weight: 9 });

  const them = await makeOwner("cat-only-them");
  await givePet(them);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("cat-only"))
    .expect(200);

  assert.equal(res.body.preview, true);
  assert.equal(res.body.pet, null);
  assert.equal(res.body.candidates.length, 1);
  assert.equal(res.body.candidates[0].score, null);
});

test("an owner with a cat and a dog browses as the dog", async () => {
  const me = await makeOwner("mixed-owner");
  await givePet(me, { name: "Mog", species: "cat", breed: "Tabby", weight: 9 });
  const dog = await givePet(me, { name: "Rex" });

  const them = await makeOwner("mixed-them");
  await givePet(them);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("mixed-owner"))
    .expect(200);

  assert.equal(res.body.preview, false);
  assert.equal(String(res.body.pet._id), String(dog._id));
  assert.equal(res.body.candidates.length, 1);
});

test("asking to browse as a cat says why rather than silently swapping pets", async () => {
  const me = await makeOwner("explicit-cat");
  const cat = await givePet(me, {
    name: "Mog",
    species: "cat",
    breed: "Tabby",
    weight: 9,
  });

  const res = await request(app)
    .get(`/api/petmatches/discover?petId=${cat._id}`)
    .set(...auth("explicit-cat"));

  assert.equal(res.status, 400);
  assert.match(res.body.message, /dog/i);
});

// --- Deciding ---------------------------------------------------------------

test("a decision involving a cat is refused", async () => {
  const me = await makeOwner("decide-cat-me");
  const cat = await givePet(me, {
    name: "Mog",
    species: "cat",
    breed: "Tabby",
    weight: 9,
  });

  const them = await makeOwner("decide-cat-them");
  const theirDog = await givePet(them);

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("decide-cat-me"))
    .send({ fromPetId: cat._id, toPetId: theirDog._id, decision: "like" });

  assert.equal(res.status, 400);
  // Nothing recorded: a decision from a cat would wait forever for a
  // reciprocal like that can never be made.
  assert.equal(await PetDecision.countDocuments({}), 0);
});

// --- Creating ---------------------------------------------------------------

test("adding a cat saves it and runs no matching", async () => {
  await makeOwner("create-cat");

  const res = await request(app)
    .post("/api/pets")
    .set(...auth("create-cat"))
    .send({ name: "Mog", species: "cat", breed: "Tabby", age: 4, weight: 9 })
    .expect(201);

  assert.equal(res.body.pet.species, "cat");
  assert.deepEqual(res.body.matches, []);
});

test("adding a pet without a species still creates a dog", async () => {
  // An older build of the app has no species picker, and only ever created
  // dogs. It must keep working.
  await makeOwner("legacy-client");

  const res = await request(app)
    .post("/api/pets")
    .set(...auth("legacy-client"))
    .send({ name: "Rex", breed: "Labrador", age: 3, weight: 30 })
    .expect(201);

  assert.equal(res.body.pet.species, "dog");
});

// --- Browsing ---------------------------------------------------------------

test("the browsable pet lists hold dogs only", async () => {
  const owner = await makeOwner("browse-owner");
  await givePet(owner, { name: "Rex" });
  await givePet(owner, { name: "Mog", species: "cat", breed: "Tabby", weight: 9 });

  const viewer = await makeOwner("browse-viewer");
  assert.ok(viewer);

  const all = await request(app)
    .get("/api/pets")
    .set(...auth("browse-viewer"))
    .expect(200);
  const latest = await request(app)
    .get("/api/pets/latest")
    .set(...auth("browse-viewer"))
    .expect(200);

  assert.deepEqual(
    all.body.map((pet) => pet.name),
    ["Rex"]
  );
  assert.deepEqual(
    latest.body.map((pet) => pet.name),
    ["Rex"]
  );
});

test("the session is told each pet's species", async () => {
  // `hasDog` is derived from this array on the client, so a projection that
  // drops `species` makes every pet look equally matchable.
  const owner = await makeOwner("session-species");
  await givePet(owner, { name: "Mog", species: "cat", breed: "Tabby", weight: 9 });

  const res = await request(app)
    .get("/api/users/me")
    .set(...auth("session-species"))
    .expect(200);

  assert.equal(res.body.pets.length, 1);
  assert.equal(res.body.pets[0].species, "cat");
});

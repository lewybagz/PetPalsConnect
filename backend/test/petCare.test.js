const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const recommend = require("../services/petCare/recommend");
const { PICKS, CATEGORIES } = require("../services/petCare/picks");
const { SPECIES } = require("../models/Content");

let app;
let User;
let Pet;

/**
 * The care hub's recommendations.
 *
 * Two halves worth testing separately: the rules, which are pure functions
 * over a table and need no database, and the route, which must only ever see
 * the caller's own pets.
 *
 * The rule that matters most is the one about what this must NOT do. A pet's
 * `specialNeeds` is free text an owner typed - "diabetic", "recovering from
 * surgery" - and it is never an input to a product recommendation. An app that
 * answered that with a link to a bag of food would be giving veterinary advice.
 */
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

const makeUser = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });

const givePet = async (user, overrides) => {
  const pet = await Pet.create({
    name: "Rex",
    species: "dog",
    age: 3,
    weight: 30,
    breed: "Labrador",
    owner: user._id,
    creator: user._id,
    ...overrides,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return pet;
};

// --- The table --------------------------------------------------------------

test("every pick names a real species and a real shelf", () => {
  for (const pick of PICKS) {
    assert.ok(
      SPECIES.includes(pick.species),
      `${pick.id} names species "${pick.species}", which is not on the Pet enum`
    );
    assert.ok(
      CATEGORIES.includes(pick.category),
      `${pick.id} names shelf "${pick.category}", which is not a category`
    );
    // A recommendation that cannot say why it is being made is an advert.
    assert.ok(pick.why, `${pick.id} has no reason attached`);
    assert.match(pick.url, /^https:\/\//, `${pick.id} does not link anywhere safe`);
  }
});

test("pick ids are unique", () => {
  const ids = PICKS.map((pick) => pick.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every species an owner can add has something to show", () => {
  // A species on the enum with no picks is a hub that greets its owner with an
  // empty screen - which is the whole thing this feature exists to avoid.
  for (const species of SPECIES) {
    const forSpecies = PICKS.filter((pick) => pick.species === species);
    assert.ok(forSpecies.length > 0, `nothing is recommended for a ${species}`);
  }
});

// --- The rules --------------------------------------------------------------

test("life stage follows the species, not one global rule", () => {
  // A cat is a kitten for about a year; a dog is a puppy for one to two.
  assert.equal(recommend.lifeStage("cat", 1.5), "adult");
  assert.equal(recommend.lifeStage("dog", 1.5), "young");
  assert.equal(recommend.lifeStage("dog", 9), "senior");
  assert.equal(recommend.lifeStage("cat", 9), "adult");
});

test("an unknown age is unknown, not 'adult'", () => {
  // A pick shown for the wrong stage is worse than one not shown.
  assert.equal(recommend.lifeStage("dog", null), null);
  assert.equal(recommend.lifeStage("dog", undefined), null);
  assert.equal(recommend.lifeStage("dog", -1), null);
});

test("only the species that record a weight get a size", () => {
  assert.equal(recommend.sizeBand("dog", 70), "large");
  assert.equal(recommend.sizeBand("cat", 6), "small");
  // The schema requires `weight` for dogs and cats and nothing else.
  assert.equal(recommend.sizeBand("fish", 2), null);
  assert.equal(recommend.sizeBand("dog", null), null);
});

test("a stage-dependent pick is left out when the stage is unknown", () => {
  const result = recommend.forPet({ species: "dog", name: "Rex" });
  const ids = result.shelves.flatMap((shelf) => shelf.picks.map((pick) => pick.id));

  assert.ok(!ids.includes("dog-puppy-food"));
  assert.ok(!ids.includes("dog-senior-food"));
  // Picks that depend on neither still show: a dog needs a toothbrush at any age.
  assert.ok(ids.includes("dog-toothbrush"));
});

test("a puppy is offered puppy food and a senior is not", () => {
  const puppy = recommend.forPet({ species: "dog", age: 1, weight: 12 });
  const old = recommend.forPet({ species: "dog", age: 10, weight: 12 });

  const idsFor = (result) =>
    result.shelves.flatMap((shelf) => shelf.picks.map((pick) => pick.id));

  assert.ok(idsFor(puppy).includes("dog-puppy-food"));
  assert.ok(!idsFor(puppy).includes("dog-senior-food"));
  assert.ok(idsFor(old).includes("dog-senior-food"));
  assert.ok(!idsFor(old).includes("dog-puppy-food"));
});

test("a pet with no species is treated as a dog", () => {
  // Rows written before the field existed; there was nothing else they could be.
  const result = recommend.forPet({ name: "Rex", age: 3, weight: 30 });
  assert.equal(result.species, "dog");
  assert.ok(result.shelves.length > 0);
});

test("a cat is never offered dog food", () => {
  const result = recommend.forPet({ species: "cat", age: 3, weight: 9 });
  const ids = result.shelves.flatMap((shelf) => shelf.picks.map((pick) => pick.id));

  assert.ok(ids.every((id) => id.startsWith("cat-")));
});

test("the filter fields never reach the client", () => {
  // How a pick was chosen is not something the screen renders, and sending it
  // invites a client to start doing the choosing itself.
  const result = recommend.forPet({ species: "dog", age: 3, weight: 30 });

  for (const shelf of result.shelves) {
    for (const pick of shelf.picks) {
      assert.equal(pick.species, undefined);
      assert.equal(pick.stages, undefined);
      assert.equal(pick.sizes, undefined);
    }
  }
});

// --- The boundary this must not cross ---------------------------------------

test("special needs never change which products are recommended", () => {
  // The load-bearing test. Deciding what to feed a pet with a condition is a
  // conversation with a vet, and this app must not have an opinion.
  const plain = recommend.forPet({ species: "dog", age: 3, weight: 30 });
  const noted = recommend.forPet({
    species: "dog",
    age: 3,
    weight: 30,
    specialNeeds: "diabetic, on insulin twice daily",
  });

  assert.deepEqual(
    noted.shelves.map((shelf) => shelf.picks.map((pick) => pick.id)),
    plain.shelves.map((shelf) => shelf.picks.map((pick) => pick.id))
  );
});

test("special needs raise the flag that sends somebody to a vet", () => {
  assert.equal(recommend.forPet({ species: "dog", age: 3, weight: 30 }).seeAVet, false);
  assert.equal(
    recommend.forPet({ species: "dog", age: 3, weight: 30, specialNeeds: "three legs" })
      .seeAVet,
    true
  );
  // Whitespace is not a note.
  assert.equal(recommend.needsVetAttention({ specialNeeds: "   " }), false);
});

// --- The route --------------------------------------------------------------

test("the hub returns picks for each of the caller's pets", async () => {
  const owner = await makeUser("hub-owner");
  await givePet(owner, { name: "Rex", species: "dog", age: 1, weight: 12 });
  await givePet(owner, {
    name: "Mog",
    species: "cat",
    breed: "Tabby",
    age: 12,
    weight: 9,
  });

  const res = await request(app)
    .get("/api/petcare/picks")
    .set(...auth("hub-owner"))
    .expect(200);

  assert.equal(res.body.pets.length, 2);

  const rex = res.body.pets.find((pet) => pet.name === "Rex");
  const mog = res.body.pets.find((pet) => pet.name === "Mog");

  assert.equal(rex.stage, "young");
  assert.equal(rex.size, "small");
  // A senior cat, which is a different answer from a senior dog at 12.
  assert.equal(mog.stage, "senior");
  assert.ok(res.body.emergency.length > 0);
});

test("the hub never shows somebody else's pets", async () => {
  const mine = await makeUser("hub-mine");
  await givePet(mine, { name: "Mine" });

  const theirs = await makeUser("hub-theirs");
  await givePet(theirs, { name: "Theirs" });

  const res = await request(app)
    .get("/api/petcare/picks")
    .set(...auth("hub-mine"))
    .expect(200);

  assert.deepEqual(
    res.body.pets.map((pet) => pet.name),
    ["Mine"]
  );
});

test("an owner with no pets gets an empty list, not an error", async () => {
  // Adding a pet is skippable, so this is an ordinary state.
  await makeUser("hub-petless");

  const res = await request(app)
    .get("/api/petcare/picks")
    .set(...auth("hub-petless"))
    .expect(200);

  assert.deepEqual(res.body.pets, []);
  assert.ok(res.body.emergency.length > 0);
});

test("a cat owner gets a full hub, which is the point of all this", async () => {
  // The owner this feature exists for: no dog, nothing to swipe, and the app
  // still has to be worth opening.
  const owner = await makeUser("hub-cat-owner");
  await givePet(owner, {
    name: "Mog",
    species: "cat",
    breed: "Tabby",
    age: 3,
    weight: 9,
  });

  const res = await request(app)
    .get("/api/petcare/picks")
    .set(...auth("hub-cat-owner"))
    .expect(200);

  assert.equal(res.body.pets.length, 1);
  assert.ok(res.body.pets[0].shelves.length > 0);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const vaccinations = require("../services/vaccinations");

let app;
let User;
let Pet;
let HealthRecord;

/**
 * Microchip and licence records.
 *
 * These reuse `HealthRecord` rather than adding fields to `Pet`, because they
 * are the same shape as a medication - a number and a date - and reusing the
 * model means one ownership rule, one screen and one delete cascade instead of
 * three new ones.
 *
 * What is specific to them is what they must *not* do: a chip does not expire,
 * so it raises no reminder and cannot be "done", and it must not affect
 * whether a pet reads as vaccinated to a stranger.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  HealthRecord = require("../models/HealthRecord");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwner = async (uid) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await Pet.create({
    name: "Sky",
    species: "dog",
    breed: "Collie",
    weight: 40,
    age: 4,
    temperament: "Friendly",
    owner: user._id,
    creator: user._id,
  });
  await User.findByIdAndUpdate(user._id, { $push: { pets: pet._id } });
  return { user, pet };
};

test("identification is its own category, separate from the vaccine kinds", () => {
  assert.equal(vaccinations.categoryOf("microchip"), "identification");
  assert.equal(vaccinations.categoryOf("licence"), "identification");
  assert.ok(vaccinations.KINDS.includes("microchip"));
  // The thing that must never happen: a chip counting towards "is this pet
  // vaccinated", which is what a stranger is shown.
  assert.ok(!vaccinations.VACCINE_KINDS.includes("microchip"));
});

test("a chip number is recorded against the pet", async () => {
  const { pet } = await makeOwner("owner");

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({
      kind: "microchip",
      label: "985141000123456",
      administeredAt: new Date().toISOString(),
      notes: "Registered with PetLink",
    })
    .expect(201);

  assert.equal(res.body.record.kind, "microchip");
  assert.equal(res.body.record.label, "985141000123456");
});

test("a chip with no number is refused - the number is the record", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "microchip", administeredAt: new Date().toISOString() })
    .expect(400);
});

test("a chip never lapses and never raises a reminder", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "microchip", label: "985141000123456", administeredAt: new Date().toISOString() })
    .expect(201);

  // No expiry means nothing to remind about: `reminderAt` is what the create
  // path consults, and it answers null without a date.
  assert.equal(vaccinations.reminderAt(undefined), null);
  assert.equal(vaccinations.nextFrom({ kind: "microchip", label: "x" }), null);
});

test("a chip cannot be marked done, the way a monthly dose can", async () => {
  const { pet } = await makeOwner("owner");

  const created = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "microchip", label: "985141000123456", administeredAt: new Date().toISOString() })
    .expect(201);

  await request(app)
    .post(`/api/pets/${pet._id}/health/${created.body.record._id}/done`)
    .set(...auth("owner"))
    .expect(400);
});

test("identification does not make a pet look vaccinated", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "microchip", label: "985141000123456", administeredAt: new Date().toISOString() })
    .expect(201);

  const status = await request(app)
    .get(`/api/pets/${pet._id}/health/status`)
    .set(...auth("owner"))
    .expect(200);

  // A pet with only a chip has shared nothing about vaccinations. "partial"
  // here would be a claim the owner never made.
  assert.equal(status.body.status, "unknown");
  assert.equal(status.body.shared, false);
});

test("a licence does expire, and behaves like every other dated record", async () => {
  const { pet } = await makeOwner("owner");
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({
      kind: "licence",
      label: "MC-20461",
      administeredAt: new Date().toISOString(),
      expiresAt: nextYear.toISOString(),
    })
    .expect(201);

  assert.ok(res.body.record.expiresAt);
  assert.ok(vaccinations.reminderAt(nextYear) instanceof Date);
});

// --- The lost-pet checklist -------------------------------------------------

test("the checklist arrives with the caller's own chip numbers", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "microchip", label: "985141000123456", administeredAt: new Date().toISOString() })
    .expect(201);

  const res = await request(app)
    .get("/api/petcare/lost-pet")
    .set(...auth("owner"))
    .expect(200);

  assert.ok(res.body.steps.length >= 3);
  // The first step is "check the registration", so the number has to be here.
  assert.equal(res.body.steps[0].id, "check-chip");
  assert.equal(res.body.identification.length, 1);
  assert.equal(res.body.identification[0].label, "985141000123456");
  assert.equal(res.body.identification[0].petName, "Sky");
  assert.ok(res.body.contacts.length >= 1);
});

test("every step cites where it came from", async () => {
  await makeOwner("owner");

  const res = await request(app)
    .get("/api/petcare/lost-pet")
    .set(...auth("owner"))
    .expect(200);

  for (const step of res.body.steps) {
    assert.ok(step.title?.trim(), `${step.id} has a title`);
    assert.ok(step.body?.trim(), `${step.id} says what to do`);
    assert.match(step.source?.url ?? "", /^https:\/\//, `${step.id} cites a source`);
  }
});

test("somebody else's chip number is not in my checklist", async () => {
  const mine = await makeOwner("mine");
  const theirs = await makeOwner("theirs");

  await HealthRecord.create({
    pet: theirs.pet._id,
    owner: theirs.user._id,
    creator: theirs.user._id,
    kind: "microchip",
    label: "THEIR-CHIP",
    administeredAt: new Date(),
  });
  await HealthRecord.create({
    pet: mine.pet._id,
    owner: mine.user._id,
    creator: mine.user._id,
    kind: "microchip",
    label: "MY-CHIP",
    administeredAt: new Date(),
  });

  const res = await request(app)
    .get("/api/petcare/lost-pet")
    .set(...auth("mine"))
    .expect(200);

  assert.deepEqual(
    res.body.identification.map((row) => row.label),
    ["MY-CHIP"]
  );
});

test("no records is an ordinary state, not an error", async () => {
  await makeOwner("owner");

  const res = await request(app)
    .get("/api/petcare/lost-pet")
    .set(...auth("owner"))
    .expect(200);

  assert.deepEqual(res.body.identification, []);
  assert.ok(res.body.steps.length >= 3, "the advice is useful with no chip recorded");
});

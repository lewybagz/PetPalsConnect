const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let WeightEntry;

/**
 * Weight history.
 *
 * Two rules carry most of the risk here. The first is units: storage is
 * pounds, always, because matching compares two pets' numbers and a stored
 * unit would make two pets incomparable if their owners had chosen
 * differently. The second is that `Pet.weight` and the newest entry must never
 * disagree - two answers to "how heavy is this dog" is the bug shape this
 * codebase has already fixed twice.
 *
 * What it must not do is prescribe. It shows the trend and the published body
 * condition scale; it never names a target.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  WeightEntry = require("../models/WeightEntry");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwner = async (uid, petFields = {}) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await Pet.create({
    name: "Bo",
    species: "dog",
    breed: "Beagle",
    weight: 20,
    age: 3,
    temperament: "Friendly",
    owner: user._id,
    creator: user._id,
    ...petFields,
  });
  await User.findByIdAndUpdate(user._id, { $push: { pets: pet._id } });
  return { user, pet };
};

test("a weigh-in is recorded and comes back in the series", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 22.4, takenAt: new Date().toISOString(), bodyCondition: 5 })
    .expect(201);

  const res = await request(app)
    .get(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .expect(200);

  assert.equal(res.body.entries.length, 1);
  assert.equal(res.body.entries[0].pounds, 22.4);
  assert.equal(res.body.entries[0].bodyCondition, 5);
  assert.equal(res.body.measured, true);
});

test("the pet's current weight follows the newest weigh-in", async () => {
  // `Pet.weight` is what size compatibility scores on. Leaving it behind would
  // give the app two answers to the same question.
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 26, takenAt: new Date().toISOString() })
    .expect(201);

  const updated = await Pet.findById(pet._id).select("weight").lean();
  assert.equal(updated.weight, 26);
});

test("back-filling an old weigh-in does not rewrite what the pet weighs now", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 26, takenAt: new Date().toISOString() })
    .expect(201);

  // A weigh-in from last year, entered afterwards.
  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 18, takenAt: new Date(Date.now() - 365 * 864e5).toISOString() })
    .expect(201);

  const updated = await Pet.findById(pet._id).select("weight").lean();
  assert.equal(updated.weight, 26, "still the most recent number, not the last typed");
});

test("deleting the newest entry moves the current weight back", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 18, takenAt: new Date(Date.now() - 30 * 864e5).toISOString() })
    .expect(201);

  const newest = await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 26, takenAt: new Date().toISOString() })
    .expect(201);

  await request(app)
    .delete(`/api/pets/${pet._id}/weight/${newest.body.entry._id}`)
    .set(...auth("owner"))
    .expect(200);

  const updated = await Pet.findById(pet._id).select("weight").lean();
  assert.equal(updated.weight, 18, "a number the owner just said was wrong is not kept");
});

test("the series is newest first", async () => {
  const { pet } = await makeOwner("owner");

  for (const [pounds, daysAgo] of [
    [18, 60],
    [26, 0],
    [22, 30],
  ]) {
    await request(app)
      .post(`/api/pets/${pet._id}/weight`)
      .set(...auth("owner"))
      .send({ pounds, takenAt: new Date(Date.now() - daysAgo * 864e5).toISOString() })
      .expect(201);
  }

  const res = await request(app)
    .get(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .expect(200);

  assert.deepEqual(
    res.body.entries.map((e) => e.pounds),
    [26, 22, 18]
  );
});

test("a species the schema stores no weight for is refused, and says so", async () => {
  const { pet } = await makeOwner("fishowner", {
    species: "fish",
    name: "Bubbles",
    breed: undefined,
    weight: undefined,
  });

  const res = await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("fishowner"))
    .send({ pounds: 0.2, takenAt: new Date().toISOString() })
    .expect(400);

  assert.equal(res.body.field, "species");

  // And the list says so rather than erroring, so the screen can explain.
  const list = await request(app)
    .get(`/api/pets/${pet._id}/weight`)
    .set(...auth("fishowner"))
    .expect(200);
  assert.equal(list.body.measured, false);
});

test("a body condition score outside the published scale is refused", async () => {
  const { pet } = await makeOwner("owner");

  // The AAHA and WSAVA scale is 1-9. A 12 is not a stricter score, it is a typo.
  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 22, takenAt: new Date().toISOString(), bodyCondition: 12 })
    .expect(400);
});

test("a nonsense weight is refused", async () => {
  const { pet } = await makeOwner("owner");

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 0, takenAt: new Date().toISOString() })
    .expect(400);

  await request(app)
    .post(`/api/pets/${pet._id}/weight`)
    .set(...auth("owner"))
    .send({ pounds: 5000, takenAt: new Date().toISOString() })
    .expect(400);
});

test("somebody else's pet is not mine to weigh or read", async () => {
  const mine = await makeOwner("mine");
  const theirs = await makeOwner("theirs");

  await WeightEntry.create({
    pet: theirs.pet._id,
    owner: theirs.user._id,
    creator: theirs.user._id,
    pounds: 30,
    takenAt: new Date(),
  });

  await request(app)
    .get(`/api/pets/${theirs.pet._id}/weight`)
    .set(...auth("mine"))
    .expect(403);

  await request(app)
    .post(`/api/pets/${theirs.pet._id}/weight`)
    .set(...auth("mine"))
    .send({ pounds: 99, takenAt: new Date().toISOString() })
    .expect(403);

  // And my own pet's history is unaffected by theirs existing.
  const list = await request(app)
    .get(`/api/pets/${mine.pet._id}/weight`)
    .set(...auth("mine"))
    .expect(200);
  assert.deepEqual(list.body.entries, []);
});

test("it needs an account", async () => {
  const { pet } = await makeOwner("owner");
  await request(app).get(`/api/pets/${pet._id}/weight`).expect(401);
});

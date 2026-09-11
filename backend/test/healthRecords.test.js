const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let HealthRecord;
let Notification;
let ScheduledJob;
let scheduler;

/**
 * Vaccination records: the owner's to write, anybody's to see the shape of.
 *
 * Two accounts and an outsider, the way `authorisation.test.js` does it - a
 * query scoped to the wrong field would pass the static audit and fail here.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  HealthRecord = require("../models/HealthRecord");
  Notification = require("../models/Notification");
  ScheduledJob = require("../models/ScheduledJob");
  scheduler = require("../services/scheduler");
  // Registers the reminder handler.
  require("../controllers/HealthRecordController");
});

test.after(async () => {
  scheduler.stop();
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const DAY = 24 * 60 * 60 * 1000;
const days = (n) => new Date(Date.now() + n * DAY).toISOString();

const makeUser = (uid, extra = {}) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    fcmToken: `token-${uid}`,
    geoLocation: { type: "Point", coordinates: [-0.1, 51.5] },
    ...extra,
  });

const makePet = async (owner, extra = {}) => {
  const pet = await Pet.create({
    name: extra.name ?? "Bo",
    weight: 20,
    age: 3,
    breed: "Beagle",
    temperament: "Friendly",
    favoriteActivities: ["fetch", "swimming"],
    owner: owner._id,
    creator: owner._id,
    ...extra,
  });
  await User.findByIdAndUpdate(owner._id, { $push: { pets: pet._id } });
  return pet;
};

const coreRecords = (owner, pet, expiresAt = days(365)) =>
  HealthRecord.insertMany(
    ["rabies", "dhpp", "bordetella"].map((kind) => ({
      pet: pet._id,
      owner: owner._id,
      creator: owner._id,
      kind,
      administeredAt: days(-30),
      expiresAt,
    }))
  );

test("an owner records a vaccination and gets the status back", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "rabies", administeredAt: days(-10), expiresAt: days(365) })
    .expect(201);

  assert.equal(res.body.record.kind, "rabies");
  assert.equal(res.body.record.verification, "selfReported");
  // One of three core vaccines is entered.
  assert.equal(res.body.status, "partial");

  const list = await request(app)
    .get(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .expect(200);
  assert.equal(list.body.records.length, 1);
  assert.equal(list.body.status, "partial");
});

test("a certificate photo makes the record documented, never verified", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({
      kind: "rabies",
      administeredAt: days(-10),
      certificatePhoto: "https://firebasestorage.googleapis.com/v0/b/x/o/cert.jpg",
      // A client cannot promote its own record.
      verification: "verified",
    })
    .expect(201);

  assert.equal(res.body.record.verification, "documented");
});

test("a certificate photo from elsewhere is dropped", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({
      kind: "rabies",
      administeredAt: days(-10),
      certificatePhoto: "https://evil.example/cert.jpg",
    })
    .expect(201);

  assert.equal(res.body.record.certificatePhoto, undefined);
  assert.equal(res.body.record.verification, "selfReported");
});

test("an unknown kind is refused", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "homeopathy", administeredAt: days(-10) })
    .expect(400);
});

test("a stranger can neither read nor write another owner's records", async () => {
  const owner = await makeUser("owner");
  await makeUser("stranger");
  const pet = await makePet(owner);
  const [record] = await coreRecords(owner, pet);

  await request(app)
    .get(`/api/pets/${pet._id}/health`)
    .set(...auth("stranger"))
    .expect(403);

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("stranger"))
    .send({ kind: "rabies", administeredAt: days(-10) })
    .expect(403);

  await request(app)
    .delete(`/api/pets/${pet._id}/health/${record._id}`)
    .set(...auth("stranger"))
    .expect(404);

  assert.equal(await HealthRecord.countDocuments({ pet: pet._id }), 3);
});

test("anybody signed in can read the derived status, and only that", async () => {
  const owner = await makeUser("owner");
  await makeUser("stranger");
  const pet = await makePet(owner);
  await coreRecords(owner, pet);

  const res = await request(app)
    .get(`/api/pets/${pet._id}/health/status`)
    .set(...auth("stranger"))
    .expect(200);

  assert.deepEqual(res.body, { status: "current", shared: true });
});

test("deleting a record changes the status", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);
  const [rabies] = await coreRecords(owner, pet);

  const res = await request(app)
    .delete(`/api/pets/${pet._id}/health/${rabies._id}`)
    .set(...auth("owner"))
    .expect(200);

  assert.equal(res.body.status, "partial");
});

test("a record with an expiry queues a reminder that notifies the owner", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    // Due in 10 days: inside the lead time, so the reminder is due now.
    .send({ kind: "bordetella", administeredAt: days(-170), expiresAt: days(10) })
    .expect(201);

  const job = await ScheduledJob.findOne({ type: "vaccination:due" }).lean();
  assert.ok(job, "no reminder was queued");
  assert.ok(job.runAt.getTime() <= Date.now() + 1000);

  await scheduler.drain();

  const notification = await Notification.findOne({ recipient: owner._id }).lean();
  assert.equal(notification.type, "vaccinationDue");
  assert.match(notification.content, /Bo's Bordetella is due/);
  // The push carries the pet, so tapping it opens that pet's health screen.
  const push = harness.firebaseStub.sent.at(-1);
  assert.equal(push.data.type, "vaccinationDue");
  assert.equal(push.data.petId, String(pet._id));
});

test("a reminder for a record that was since deleted does nothing", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  const res = await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "rabies", administeredAt: days(-10), expiresAt: days(5) })
    .expect(201);

  await HealthRecord.deleteOne({ _id: res.body.record._id });
  await scheduler.drain();

  assert.equal(await Notification.countDocuments({ recipient: owner._id }), 0);
  const job = await ScheduledJob.findOne({ type: "vaccination:due" }).lean();
  assert.equal(job.status, "completed");
});

test("a record with no expiry queues nothing", async () => {
  const owner = await makeUser("owner");
  const pet = await makePet(owner);

  await request(app)
    .post(`/api/pets/${pet._id}/health`)
    .set(...auth("owner"))
    .send({ kind: "rabies", administeredAt: days(-10) })
    .expect(201);

  assert.equal(await ScheduledJob.countDocuments({ type: "vaccination:due" }), 0);
});

test("every deck card carries the candidate's vaccination status", async () => {
  const me = await makeUser("me");
  const other = await makeUser("other");
  await makePet(me, { name: "Rex" });
  const shared = await makePet(other, { name: "Sky" });
  await coreRecords(other, shared);
  const third = await makeUser("third");
  await makePet(third, { name: "Ash" });

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("me"))
    .expect(200);

  const byName = Object.fromEntries(
    res.body.candidates.map((candidate) => [candidate.pet.name, candidate.vaccination])
  );
  assert.equal(byName.Sky, "current");
  assert.equal(byName.Ash, "unknown");
});

test("requireVaccinationShared narrows the deck to pets with current records", async () => {
  const me = await makeUser("me", { discovery: { requireVaccinationShared: true } });
  const other = await makeUser("other");
  const third = await makeUser("third");
  await makePet(me, { name: "Rex" });
  const shared = await makePet(other, { name: "Sky" });
  await coreRecords(other, shared);
  const lapsed = await makePet(third, { name: "Ash" });
  await coreRecords(third, lapsed, days(-1));

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("me"))
    .expect(200);

  assert.deepEqual(
    res.body.candidates.map((candidate) => candidate.pet.name),
    ["Sky"]
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let Pet;
let User;
let Notification;
let ScheduledJob;
let scheduler;
let nudge;

/**
 * The nudge that keeps onboarding's promise.
 *
 * `AddFirstPetScreen` asks for the minimum and defers temperament, activity
 * level and socialisation behind a footnote saying they "help us find even
 * better matches" - and nothing ever asked again, so three fields the matcher
 * scores on stayed empty for everybody who came through onboarding.
 *
 * The two properties worth pinning: it does not fire when there is nothing
 * left to ask (a nudge with no question is a nag), and it survives the pet
 * being deleted or completed after the job was queued.
 */
test.before(async () => {
  app = await harness.start();
  Pet = require("../models/Pet");
  User = require("../models/User");
  Notification = require("../models/Notification");
  ScheduledJob = require("../models/ScheduledJob");
  scheduler = require("../services/scheduler");
  nudge = require("../services/petProfileNudge");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = async (uid) => {
  await request(app)
    .post("/api/users")
    .set(...auth(uid))
    .send({ acceptedTerms: true, username: uid, zip: "85004" })
    .expect(201);
  return User.findOne({ firebaseUid: uid }).lean();
};

const addPet = async (uid, fields = {}) => {
  const res = await request(app)
    .post("/api/pets")
    .set(...auth(uid))
    .send({ name: "Rex", species: "dog", breed: "Beagle", age: 3, weight: 30, ...fields })
    .expect(201);
  return res.body.pet;
};

/** Runs the queued job now, whatever it was scheduled for. */
const runDue = async () => {
  await ScheduledJob.updateMany({}, { $set: { runAt: new Date(Date.now() - 1000) } });
  await scheduler.drain();
};

test("adding a pet queues a nudge about the fields onboarding deferred", async () => {
  await signUp("owner");
  const pet = await addPet("owner");

  const job = await ScheduledJob.findOne({ type: nudge.PROFILE_NUDGE_JOB }).lean();
  assert.ok(job, "a nudge should be queued");
  assert.equal(job.payload.petId, String(pet._id));

  // Two days out, not immediately: the point is to catch somebody once they
  // have seen what a match looks like, not to append a fourth signup form.
  const delay = new Date(job.runAt).getTime() - Date.now();
  assert.ok(delay > 47 * 60 * 60 * 1000, "should be about two days away");
  assert.ok(delay <= nudge.NUDGE_DELAY_MS + 5000);
});

test("the nudge names the pet and points at its profile", async () => {
  const owner = await signUp("owner");
  const pet = await addPet("owner", { name: "Bella" });

  await runDue();

  const rows = await Notification.find({ recipient: owner._id }).lean();
  const raised = rows.find((row) => row.type === "petProfileIncomplete");
  assert.ok(raised, "the nudge should have been raised");
  assert.match(raised.content, /Bella/);
  assert.equal(raised.data.petId, String(pet._id));
});

test("no nudge is queued when the full form already answered everything", async () => {
  await signUp("thorough");
  await addPet("thorough", {
    temperament: "Calm",
    activityLevel: "moderate",
    socialisation: "balanced",
  });

  // A nudge with no question is a nag.
  assert.equal(await ScheduledJob.countDocuments({ type: nudge.PROFILE_NUDGE_JOB }), 0);
});

test("a pet completed after the job was queued raises nothing", async () => {
  const owner = await signUp("later");
  const pet = await addPet("later");

  await Pet.updateOne(
    { _id: pet._id },
    { temperament: "Playful", activityLevel: "high", socialisation: "extrovert" }
  );

  await runDue();

  const rows = await Notification.find({
    recipient: owner._id,
    type: "petProfileIncomplete",
  }).lean();
  assert.equal(rows.length, 0, "the job re-reads the pet rather than trusting the payload");
});

test("a pet deleted after the job was queued raises nothing", async () => {
  const owner = await signUp("gone");
  const pet = await addPet("gone");

  await Pet.deleteOne({ _id: pet._id });

  // Must not throw, and must not notify.
  await runDue();

  assert.equal(
    await Notification.countDocuments({ recipient: owner._id, type: "petProfileIncomplete" }),
    0
  );
});

test("a partly-filled profile is still worth asking about", async () => {
  await signUp("partial");
  await addPet("partial", { temperament: "Calm" });

  // Two of the three are still missing, and both feed the matcher.
  assert.equal(await ScheduledJob.countDocuments({ type: nudge.PROFILE_NUDGE_JOB }), 1);
});

test("missingFields names exactly the deferred three", () => {
  assert.deepEqual(nudge.DEFERRED_FIELDS, [
    "temperament",
    "activityLevel",
    "socialisation",
  ]);
  assert.deepEqual(nudge.missingFields({}), nudge.DEFERRED_FIELDS);
  assert.deepEqual(
    nudge.missingFields({
      temperament: "Calm",
      activityLevel: "low",
      socialisation: "introvert",
    }),
    []
  );
  // Whitespace is not an answer.
  assert.deepEqual(nudge.missingFields({ temperament: "   " }), nudge.DEFERRED_FIELDS);
});

/**
 * A notification's row carries what its destination needs.
 *
 * `notify()` took a `data` object and put it only in the *push*, while
 * `Notification` had no `data` field at all - so a `vaccinationDue` tapped
 * from a lock screen opened the right pet and the same notification tapped in
 * the app's own list opened `PetHealth` with no `petId`. Four types were in
 * that state; `notificationTypes.js` names a `param` for each of them
 * precisely so a tap lands somewhere.
 */
test("a stored notification carries the id its screen routes on", async () => {
  const owner = await signUp("router");
  const pet = await addPet("router");

  await runDue();

  const row = await Notification.findOne({
    recipient: owner._id,
    type: "petProfileIncomplete",
  }).lean();

  // What the app's `destinationFor` reads off the row.
  const { TYPES } = require("../services/notificationTypes");
  const param = TYPES.petProfileIncomplete.param;
  assert.equal(row.data[param], String(pet._id));
});

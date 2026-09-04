const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Location;
let Playdate;
let Notification;
let realtime;

/**
 * Playdates: the end of the loop that discovery and chat lead to.
 *
 * `createPlaydate` had never once succeeded. `startTime` is required by the
 * schema and was never set, so every attempt failed validation with a 400 -
 * and the app sent `Date`/`Location`/`Creator` in PascalCase, which strict
 * mode drops, so three more required fields were missing on top.
 *
 * `creator` came from the request body, and `participants` was whatever the
 * client sent - in practice only the organiser. That is the same
 * one-participant bug direct messages had: the person being invited was never
 * in the record, so it never showed up for them and they could not accept it.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Location = require("../models/Location");
  Playdate = require("../models/Playdate");
  Notification = require("../models/Notification");
  realtime = require("../services/realtime");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  realtime.setIO(null);
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwnerWithPet = async (uid) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await Pet.create({
    name: `${uid}-pet`,
    weight: 20,
    breed: "Whippet",
    age: 4,
    owner: user._id,
    creator: user._id,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { user, pet };
};

let parkSeq = 0;
const makePark = () =>
  Location.create({
    address: "12 Green Lane",
    description: "Dog park",
    placeId: `place-${(parkSeq += 1)}`,
  });

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const schedule = async (uid, { pets, location, ...rest }) =>
  request(app)
    .post("/api/playdates")
    .set(...auth(uid))
    .send({
      date: tomorrow(),
      location: String(location._id),
      petsInvolved: pets.map((pet) => String(pet._id)),
      notes: "Bring a ball",
      ...rest,
    });

test("scheduling a playdate stores it", async () => {
  const alice = await makeOwnerWithPet("pd-alice");
  const bob = await makeOwnerWithPet("pd-bob");
  const park = await makePark();

  const res = await schedule("pd-alice", { pets: [alice.pet, bob.pet], location: park });

  assert.equal(res.status, 201, JSON.stringify(res.body));

  const stored = await Playdate.findById(res.body._id).lean();
  assert.ok(stored, "the playdate must exist");
  assert.equal(stored.status, "pending");
  assert.equal(String(stored.creator), String(alice.user._id));
  // Required by the schema and never set, which is what made every create a 400.
  assert.ok(stored.startTime, "startTime must be set");
});

test("the people whose pets are coming are participants", async () => {
  const alice = await makeOwnerWithPet("part-alice");
  const bob = await makeOwnerWithPet("part-bob");
  const park = await makePark();

  const res = await schedule("part-alice", { pets: [alice.pet, bob.pet], location: park });

  const stored = await Playdate.findById(res.body._id).lean();
  const participants = stored.participants.map(String).sort();
  assert.deepEqual(
    participants,
    [String(alice.user._id), String(bob.user._id)].sort(),
    "without the invitee here the request is invisible to them"
  );
});

test("the organiser comes from the token", async () => {
  const alice = await makeOwnerWithPet("cre-alice");
  const bob = await makeOwnerWithPet("cre-bob");
  const park = await makePark();

  const res = await schedule("cre-alice", {
    pets: [alice.pet, bob.pet],
    location: park,
    creator: String(bob.user._id),
  });

  const stored = await Playdate.findById(res.body._id).lean();
  assert.equal(String(stored.creator), String(alice.user._id));
});

test("the date and a separate start time are both kept", async () => {
  const alice = await makeOwnerWithPet("time-alice");
  const bob = await makeOwnerWithPet("time-bob");
  const park = await makePark();

  const startTime = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
  const res = await schedule("time-alice", {
    pets: [alice.pet, bob.pet],
    location: park,
    startTime,
  });

  const stored = await Playdate.findById(res.body._id).lean();
  // The form has a date picker and a time picker; only the date used to be sent.
  assert.equal(stored.startTime.toISOString(), startTime);
});

test("the invitee is notified", async () => {
  await makeOwnerWithPet("notify-alice");
  const bob = await makeOwnerWithPet("notify-bob");
  const park = await makePark();
  const alice = await User.findOne({ firebaseUid: "notify-alice" }).populate("pets");

  const created = await schedule("notify-alice", {
    pets: [alice.pets[0], bob.pet],
    location: park,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const notification = await Notification.findOne({ recipient: bob.user._id }).lean();
  assert.ok(notification, "the invitee heard nothing");
  assert.match(notification.content, /playdate/i);
});

test("you must include one of your own pets", async () => {
  await makeOwnerWithPet("out-alice");
  const bob = await makeOwnerWithPet("out-bob");
  const carol = await makeOwnerWithPet("out-carol");
  const park = await makePark();

  const res = await schedule("out-alice", { pets: [bob.pet, carol.pet], location: park });

  assert.equal(res.status, 403);
  assert.equal(await Playdate.countDocuments({}), 0);
});

test("an unknown location is refused", async () => {
  const mongoose = require("mongoose");
  const alice = await makeOwnerWithPet("loc-alice");

  const res = await request(app)
    .post("/api/playdates")
    .set(...auth("loc-alice"))
    .send({
      date: tomorrow(),
      location: String(new mongoose.Types.ObjectId()),
      petsInvolved: [String(alice.pet._id)],
    });

  assert.equal(res.status, 404);
});

test("a playdate with no pets is refused", async () => {
  await makeOwnerWithPet("empty-alice");
  const park = await makePark();

  const res = await request(app)
    .post("/api/playdates")
    .set(...auth("empty-alice"))
    .send({ date: tomorrow(), location: String(park._id), petsInvolved: [] });

  assert.equal(res.status, 400);
});

// --- Accepting and declining -----------------------------------------------

const scheduledBetween = async () => {
  const alice = await makeOwnerWithPet("flow-alice");
  const bob = await makeOwnerWithPet("flow-bob");
  const park = await makePark();
  const res = await schedule("flow-alice", {
    pets: [alice.pet, bob.pet],
    location: park,
  });
  return { alice, bob, playdateId: res.body._id };
};

test("the invitee can accept", async () => {
  const { playdateId } = await scheduledBetween();

  const res = await request(app)
    .post(`/api/playdates/accept/${playdateId}`)
    .set(...auth("flow-bob"));

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const stored = await Playdate.findById(playdateId).lean();
  assert.equal(stored.status, "accepted");
});

test("someone who was not invited cannot accept", async () => {
  const { playdateId } = await scheduledBetween();
  await makeOwnerWithPet("gatecrash");

  const res = await request(app)
    .post(`/api/playdates/accept/${playdateId}`)
    .set(...auth("gatecrash"));

  // This used to push the caller onto the participants and accept for them.
  assert.equal(res.status, 403);
  const stored = await Playdate.findById(playdateId).lean();
  assert.equal(stored.status, "pending");
  assert.equal(stored.participants.length, 2);
});

test("the organiser does not accept their own invitation", async () => {
  const { playdateId } = await scheduledBetween();

  const res = await request(app)
    .post(`/api/playdates/accept/${playdateId}`)
    .set(...auth("flow-alice"));

  assert.equal(res.status, 400);
});

test("accepting twice is refused", async () => {
  const { playdateId } = await scheduledBetween();

  await request(app).post(`/api/playdates/accept/${playdateId}`).set(...auth("flow-bob")).expect(200);
  const res = await request(app)
    .post(`/api/playdates/accept/${playdateId}`)
    .set(...auth("flow-bob"));

  assert.equal(res.status, 409);
});

test("declining tells the organiser", async () => {
  const { alice, playdateId } = await scheduledBetween();

  await request(app)
    .post(`/api/playdates/decline/${playdateId}`)
    .set(...auth("flow-bob"))
    .expect(200);

  const stored = await Playdate.findById(playdateId).lean();
  assert.equal(stored.status, "declined");

  // Declining used to be silent, so the organiser waited on an answer that had
  // already been given.
  const notification = await Notification.findOne({
    recipient: alice.user._id,
    content: /declined/i,
  }).lean();
  assert.ok(notification, "the organiser was not told");
});

test("upcoming playdates are only your own", async () => {
  const { playdateId } = await scheduledBetween();
  await request(app).post(`/api/playdates/accept/${playdateId}`).set(...auth("flow-bob")).expect(200);

  await makeOwnerWithPet("stranger");
  const res = await request(app)
    .get("/api/playdates/upcoming")
    .set(...auth("stranger"))
    .expect(200);

  // This returned every accepted playdate in the database.
  assert.deepEqual(res.body, []);

  const mine = await request(app)
    .get("/api/playdates/upcoming")
    .set(...auth("flow-bob"))
    .expect(200);
  assert.equal(mine.body.length, 1);
});

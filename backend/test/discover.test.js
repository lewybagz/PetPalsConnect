const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let PetDecision;
let PetMatch;
let Notification;
let realtime;

/**
 * Discovery: the loop the app was missing.
 *
 * The matching engine ranked pets and wrote PetMatch rows, but nothing ever
 * showed them to anyone - there was no browse screen and no way to say yes or
 * no. These cover the two halves that make it a product: candidates a person
 * has not judged yet, and a decision that sticks and can become a match.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  PetDecision = require("../models/PetDecision");
  PetMatch = require("../models/PetMatch");
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

const makeOwnerWithPet = async (uid, overrides = {}) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await Pet.create({
    name: `${uid}-pet`,
    weight: 30,
    breed: "Labrador",
    age: 3,
    temperament: "Playful",
    favoriteActivities: ["Fetch"],
    owner: user._id,
    creator: user._id,
    ...overrides,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { user, pet };
};

// --- Discover ---------------------------------------------------------------

test("candidates are other people's pets, ranked", async () => {
  await makeOwnerWithPet("disc-me");
  await makeOwnerWithPet("disc-them");

  const res = await request(app).get("/api/petmatches/discover").set(...auth("disc-me"));

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.candidates.length, 1);
  assert.equal(res.body.candidates[0].pet.name, "disc-them-pet");
  assert.equal(typeof res.body.candidates[0].score, "number");
});

test("your own pets are never candidates", async () => {
  const me = await makeOwnerWithPet("own-me");
  await Pet.create({
    name: "second dog",
    weight: 20,
    breed: "Beagle",
    age: 2,
    owner: me.user._id,
    creator: me.user._id,
  });

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("own-me"))
    .expect(200);

  assert.deepEqual(res.body.candidates, []);
});

test("a pet you already passed on does not come back", async () => {
  const me = await makeOwnerWithPet("pass-me");
  const them = await makeOwnerWithPet("pass-them");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("pass-me"))
    .send({ fromPetId: me.pet._id, toPetId: them.pet._id, decision: "pass" })
    .expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("pass-me"))
    .expect(200);

  assert.deepEqual(res.body.candidates, []);
});

/**
 * Browsing without a pet of your own.
 *
 * This answered an empty deck. The add-a-pet step is skippable by design, so
 * somebody who skipped it landed in an app whose entire reason to exist showed
 * them nothing - and had no way to find out what they had skipped for. The
 * retention research the redesign leans on is blunt about this: the users who
 * never reach a core value action in the first session are the ones who leave.
 */
test("having no pet shows the deck in preview rather than an empty state", async () => {
  await User.create({
    firebaseUid: "petless",
    username: "petless",
    email: "petless@example.test",
  });
  await makeOwnerWithPet("has-a-pet");

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("petless"))
    .expect(200);

  assert.equal(res.body.pet, null);
  assert.equal(res.body.preview, true);
  assert.equal(res.body.candidates.length, 1);
});

test("a preview carries no score, because there is nothing to compare against", async () => {
  await User.create({
    firebaseUid: "petless-score",
    username: "petless-score",
    email: "petless-score@example.test",
  });
  await makeOwnerWithPet("scored-pet");

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("petless-score"))
    .expect(200);

  // A number here would be one the client has to know to distrust.
  assert.equal(res.body.candidates[0].score, null);
  assert.equal(res.body.candidates[0].breakdown, null);
  assert.ok(res.body.candidates[0].pet.name);
});

test("a preview is not a way round a block", async () => {
  const me = await User.create({
    firebaseUid: "petless-blocker",
    username: "petless-blocker",
    email: "petless-blocker@example.test",
  });
  const them = await makeOwnerWithPet("blocked-owner");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("petless-blocker"))
    .send({ blockedUser: String(them.user._id) })
    .expect(201);
  assert.ok(me._id);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("petless-blocker"))
    .expect(200);

  // Both paths through discovery share one candidate loader precisely so a
  // safety rule cannot be enforced on one of them and forgotten on the other.
  assert.deepEqual(res.body.candidates, []);
});

test("a preview does not show a suspended account's pets", async () => {
  await User.create({
    firebaseUid: "petless-viewer",
    username: "petless-viewer",
    email: "petless-viewer@example.test",
  });
  const them = await makeOwnerWithPet("suspended-owner");
  await User.updateOne({ _id: them.user._id }, { suspended: true });

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("petless-viewer"))
    .expect(200);

  assert.deepEqual(res.body.candidates, []);
});

test("a preview never includes your own pets", async () => {
  // Reachable when somebody deletes their last pet but the profile remains.
  const mine = await makeOwnerWithPet("solo-owner");
  await User.updateOne({ _id: mine.user._id }, { $set: { pets: [] } });

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("solo-owner"))
    .expect(200);

  assert.equal(res.body.preview, true);
  assert.deepEqual(res.body.candidates, []);
});

test("you cannot browse as somebody else's pet", async () => {
  await makeOwnerWithPet("browse-me");
  const them = await makeOwnerWithPet("browse-them");

  const res = await request(app)
    .get(`/api/petmatches/discover?petId=${them.pet._id}`)
    .set(...auth("browse-me"));

  assert.equal(res.status, 403);
});

// --- Deciding ---------------------------------------------------------------

test("a like is recorded once, however many times it is sent", async () => {
  const me = await makeOwnerWithPet("dup-me");
  const them = await makeOwnerWithPet("dup-them");

  const body = { fromPetId: me.pet._id, toPetId: them.pet._id, decision: "like" };
  await request(app).post("/api/petmatches/decide").set(...auth("dup-me")).send(body).expect(200);
  await request(app).post("/api/petmatches/decide").set(...auth("dup-me")).send(body).expect(200);

  assert.equal(await PetDecision.countDocuments({ fromPet: me.pet._id }), 1);
});

test("one-sided interest is not a match", async () => {
  const me = await makeOwnerWithPet("one-me");
  const them = await makeOwnerWithPet("one-them");

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("one-me"))
    .send({ fromPetId: me.pet._id, toPetId: them.pet._id, decision: "like" })
    .expect(200);

  assert.equal(res.body.mutual, false);
  assert.equal(await PetMatch.countDocuments({}), 0);
});

test("liking back makes a match, and tells both owners", async () => {
  const alice = await makeOwnerWithPet("match-alice");
  const bob = await makeOwnerWithPet("match-bob");
  const emitted = [];
  realtime.setIO({
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  });

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("match-alice"))
    .send({ fromPetId: alice.pet._id, toPetId: bob.pet._id, decision: "like" })
    .expect(200);

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("match-bob"))
    .send({ fromPetId: bob.pet._id, toPetId: alice.pet._id, decision: "like" })
    .expect(200);

  assert.equal(res.body.mutual, true);
  assert.equal(res.body.matchedPet.name, "match-alice-pet");

  // Recorded from both sides so either owner's match list shows it.
  assert.equal(await PetMatch.countDocuments({ relevantToUser: alice.user._id }), 1);
  assert.equal(await PetMatch.countDocuments({ relevantToUser: bob.user._id }), 1);

  // Neither owner has to be looking at the screen when it happens.
  const matchEvents = emitted.filter((event) => event.event === "petMatch");
  assert.equal(matchEvents.length, 2);
  assert.equal(await Notification.countDocuments({ recipient: alice.user._id }), 1);
  assert.equal(await Notification.countDocuments({ recipient: bob.user._id }), 1);
});

test("a pass after a like does not resurrect the match", async () => {
  const alice = await makeOwnerWithPet("flip-alice");
  const bob = await makeOwnerWithPet("flip-bob");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("flip-alice"))
    .send({ fromPetId: alice.pet._id, toPetId: bob.pet._id, decision: "like" })
    .expect(200);

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("flip-alice"))
    .send({ fromPetId: alice.pet._id, toPetId: bob.pet._id, decision: "pass" })
    .expect(200);

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("flip-bob"))
    .send({ fromPetId: bob.pet._id, toPetId: alice.pet._id, decision: "like" })
    .expect(200);

  assert.equal(res.body.mutual, false);
});

test("you cannot decide with a pet that is not yours", async () => {
  await makeOwnerWithPet("spoof-me");
  const them = await makeOwnerWithPet("spoof-them");
  const other = await makeOwnerWithPet("spoof-other");

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("spoof-me"))
    .send({ fromPetId: them.pet._id, toPetId: other.pet._id, decision: "like" });

  assert.equal(res.status, 403);
  assert.equal(await PetDecision.countDocuments({}), 0);
});

test("an invalid decision is refused", async () => {
  const me = await makeOwnerWithPet("bad-me");
  const them = await makeOwnerWithPet("bad-them");

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("bad-me"))
    .send({ fromPetId: me.pet._id, toPetId: them.pet._id, decision: "maybe" });

  assert.equal(res.status, 400);
});

test("a pet cannot decide on itself", async () => {
  const me = await makeOwnerWithPet("self-me");

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("self-me"))
    .send({ fromPetId: me.pet._id, toPetId: me.pet._id, decision: "like" });

  assert.equal(res.status, 400);
});

// --- Distance ---------------------------------------------------------------

const LONDON = { latitude: 51.5072, longitude: -0.1276 };
const BRIGHTON = { latitude: 50.8225, longitude: -0.1372 }; // ~47 miles
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

const shareLocation = (uid, position) =>
  request(app)
    .put("/api/users/me/location")
    .set(...auth(uid))
    .send(position);

test("a position is stored as GeoJSON, longitude first", async () => {
  const me = await makeOwnerWithPet("geo-me");

  await shareLocation("geo-me", LONDON).expect(200);

  const stored = await User.findById(me.user._id).lean();
  // Getting this order wrong puts London in Antarctica.
  assert.deepEqual(stored.geoLocation.coordinates, [-0.1276, 51.5072]);
  assert.ok(stored.locationUpdatedAt);
});

test("a position without both numbers is refused", async () => {
  await makeOwnerWithPet("geo-bad");

  await shareLocation("geo-bad", { latitude: 51.5 }).expect(400);
  await shareLocation("geo-bad", { latitude: 200, longitude: 0 }).expect(400);
});

test("someone with location sharing off is not stored anyway", async () => {
  const me = await makeOwnerWithPet("geo-private");
  await User.updateOne({ _id: me.user._id }, { locationSharingEnabled: false });

  const res = await shareLocation("geo-private", LONDON).expect(200);

  assert.equal(res.body.stored, false);
  const stored = await User.findById(me.user._id).lean();
  assert.equal(stored.geoLocation?.coordinates, undefined);
});

test("candidates beyond the range are not offered", async () => {
  const me = await makeOwnerWithPet("range-me");
  await makeOwnerWithPet("range-near");
  await makeOwnerWithPet("range-far");

  await User.updateOne({ _id: me.user._id }, { playdateRange: 20 });
  await shareLocation("range-me", LONDON).expect(200);
  await shareLocation("range-near", LONDON).expect(200);
  await shareLocation("range-far", NEW_YORK).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("range-me"))
    .expect(200);

  const names = res.body.candidates.map((candidate) => candidate.pet.name);
  assert.deepEqual(names, ["range-near-pet"]);
});

test("a wider range reaches further", async () => {
  const me = await makeOwnerWithPet("wide-me");
  await makeOwnerWithPet("wide-them");

  await User.updateOne({ _id: me.user._id }, { playdateRange: 50 });
  await shareLocation("wide-me", LONDON).expect(200);
  await shareLocation("wide-them", BRIGHTON).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("wide-me"))
    .expect(200);

  assert.equal(res.body.candidates.length, 1);
  // Brighton is about 47 miles from London.
  assert.ok(res.body.candidates[0].distanceMiles > 40);
  assert.ok(res.body.candidates[0].distanceMiles < 55);
});

test("a range of 0 keeps everyone, however far", async () => {
  const me = await makeOwnerWithPet("all-me");
  await makeOwnerWithPet("all-them");
  await User.updateOne({ _id: me.user._id }, { playdateRange: 0 });

  await shareLocation("all-me", LONDON).expect(200);
  await shareLocation("all-them", NEW_YORK).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("all-me"))
    .expect(200);

  assert.equal(res.body.candidates.length, 1);
  assert.ok(res.body.candidates[0].distanceMiles > 3000);
});

test("someone who has not shared a position is still shown", async () => {
  const me = await makeOwnerWithPet("unknown-me");
  await makeOwnerWithPet("unknown-them");

  await User.updateOne({ _id: me.user._id }, { playdateRange: 10 });
  await shareLocation("unknown-me", LONDON).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("unknown-me"))
    .expect(200);

  // Dropping them empties the deck early on, when almost nobody has shared.
  assert.equal(res.body.candidates.length, 1);
  assert.equal(res.body.candidates[0].distanceMiles, null);
});

test("without a position of your own, everyone stays in", async () => {
  const me = await makeOwnerWithPet("nowhere-me");
  await makeOwnerWithPet("nowhere-them");

  await User.updateOne({ _id: me.user._id }, { playdateRange: 10 });
  await shareLocation("nowhere-them", NEW_YORK).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("nowhere-me"))
    .expect(200);

  assert.equal(res.body.locationKnown, false);
  assert.equal(res.body.candidates.length, 1);
});

test("the deck reports the range it applied", async () => {
  const me = await makeOwnerWithPet("report-me");
  await User.updateOne({ _id: me.user._id }, { playdateRange: 20 });
  await shareLocation("report-me", LONDON).expect(200);

  const res = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("report-me"))
    .expect(200);

  assert.equal(res.body.range, 20);
  assert.equal(res.body.locationKnown, true);
});

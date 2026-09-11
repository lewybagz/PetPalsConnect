const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let PetMatch;

/**
 * A setting that is stored but not honoured is the thing being fixed here.
 *
 * The app's Privacy screen had two toggles that wrote nowhere, and this
 * codebase has form for the other half of the same mistake: suspension was
 * stored and filtered discovery while leaving a suspended account able to
 * message anybody, and blocking was a model and a controller that nothing
 * queried.
 *
 * So every setting gets a test here that changes an answer the API gives.
 * `settings.test.js` proves they save; this proves they matter.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  PetMatch = require("../models/PetMatch");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeUser = (uid, extra = {}) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    geoLocation: { type: "Point", coordinates: [-0.1, 51.5] },
    ...extra,
  });

/**
 * A pet that will actually score.
 *
 * The scored deck drops anything under `MATCH_THRESHOLD`, so a pet with no
 * temperament and no activities is filtered out by ranking before a discovery
 * setting could be seen to do anything. Matching on temperament, breed and
 * activities puts these comfortably over the line, which leaves the weight and
 * age filters as the only thing varying between the cases below.
 */
const makePet = (owner, extra = {}) =>
  Pet.create({
    name: extra.name ?? "Bo",
    weight: extra.weight ?? 20,
    age: extra.age ?? 3,
    breed: "Beagle",
    temperament: "Playful",
    favoriteActivities: ["Fetch", "Swimming"],
    owner: owner._id,
    creator: owner._id,
    ...extra,
  });

/** Links a pet onto its owner, which `createPet` normally does. */
const own = async (user, pet) => {
  await User.findByIdAndUpdate(user._id, { $push: { pets: pet._id } });
  return pet;
};

// ---------------------------------------------------------------------------
// Vaccinations
// ---------------------------------------------------------------------------

test("discovery.requireVaccinationShared leaves out a pet with no records", async () => {
  const me = await makeUser("me", { discovery: { requireVaccinationShared: true } });
  const other = await makeUser("other");
  await own(me, await makePet(me, { name: "Rex" }));
  await own(other, await makePet(other, { name: "Sky" }));

  const strict = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("me"))
    .expect(200);
  assert.deepEqual(strict.body.candidates, []);

  // Off, the same pet is in the deck - so the setting is what removed it.
  await User.findByIdAndUpdate(me._id, {
    $set: { "discovery.requireVaccinationShared": false },
  });
  const open = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("me"))
    .expect(200);
  assert.deepEqual(
    open.body.candidates.map((candidate) => candidate.pet.name),
    ["Sky"]
  );
});

// ---------------------------------------------------------------------------
// Who may message
// ---------------------------------------------------------------------------

test("messagesFrom: friends keeps a stranger out of your inbox", async () => {
  const owner = await makeUser("owner", { privacy: { messagesFrom: "friends" } });
  const stranger = await makeUser("stranger");
  const pet = await own(owner, await makePet(owner));
  await own(stranger, await makePet(stranger, { name: "Sky" }));

  const refused = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("stranger"))
    .send({ petId: String(pet._id) });

  assert.equal(refused.status, 403);
  // The same wording as a block. "They only accept messages from friends"
  // tells a stranger exactly what to do next.
  assert.match(refused.body.message, /not available/);
});

test("messagesFrom: friends still lets a friend through", async () => {
  const owner = await makeUser("owner", { privacy: { messagesFrom: "friends" } });
  const friend = await makeUser("friend");
  await User.findByIdAndUpdate(owner._id, { $push: { friendsList: friend._id } });
  await User.findByIdAndUpdate(friend._id, { $push: { friendsList: owner._id } });

  const pet = await own(owner, await makePet(owner));
  await own(friend, await makePet(friend, { name: "Sky" }));

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("friend"))
    .send({ petId: String(pet._id) })
    .expect(200);
});

test("messagesFrom: matches lets somebody whose pet matched through", async () => {
  const owner = await makeUser("owner", { privacy: { messagesFrom: "matches" } });
  const other = await makeUser("other");
  const mine = await own(owner, await makePet(owner));
  const theirs = await own(other, await makePet(other, { name: "Sky" }));

  await PetMatch.create({
    pet1: mine._id,
    pet2: theirs._id,
    relevantToUser: owner._id,
    creator: owner._id,
    matchScore: 80,
  });

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("other"))
    .send({ petId: String(mine._id) })
    .expect(200);
});

test("the default lets anybody message, so nothing changes for an old account", async () => {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  const pet = await own(owner, await makePet(owner));
  await own(stranger, await makePet(stranger, { name: "Sky" }));

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("stranger"))
    .send({ petId: String(pet._id) })
    .expect(200);
});

// ---------------------------------------------------------------------------
// Who may send a friend request
// ---------------------------------------------------------------------------

test("friendRequestsFrom: nobody refuses the request", async () => {
  const owner = await makeUser("owner", { privacy: { friendRequestsFrom: "nobody" } });
  await makeUser("stranger");

  const response = await request(app)
    .post("/api/friendrequests")
    .set(...auth("stranger"))
    .send({ receiver: String(owner._id) });

  assert.equal(response.status, 403);
});

test("friendRequestsFrom: friendsOfFriends needs a friend in common", async () => {
  const owner = await makeUser("owner", {
    privacy: { friendRequestsFrom: "friendsOfFriends" },
  });
  const mutual = await makeUser("mutual");
  const stranger = await makeUser("stranger");
  const outsider = await makeUser("outsider");

  await User.findByIdAndUpdate(owner._id, { $push: { friendsList: mutual._id } });
  await User.findByIdAndUpdate(stranger._id, { $push: { friendsList: mutual._id } });

  await request(app)
    .post("/api/friendrequests")
    .set(...auth("stranger"))
    .send({ receiver: String(owner._id) })
    .expect(201);

  const refused = await request(app)
    .post("/api/friendrequests")
    .set(...auth("outsider"))
    .send({ receiver: String(owner._id) });

  assert.equal(refused.status, 403);
  assert.ok(outsider);
});

// ---------------------------------------------------------------------------
// Being found
// ---------------------------------------------------------------------------

test("discoverableInSearch: false takes you out of username search", async () => {
  await makeUser("searcher");
  await makeUser("hidden", { privacy: { discoverableInSearch: false } });
  await makeUser("hidden2");

  const response = await request(app)
    .get("/api/users?q=hidden")
    .set(...auth("searcher"))
    .expect(200);

  const names = response.body.map((row) => row.username);
  assert.ok(!names.includes("hidden"), "an opted-out account must not be findable");
  assert.ok(names.includes("hidden2"), "everybody else still is");
});

test("an account that never set the preference stays findable", async () => {
  await makeUser("searcher");
  await makeUser("findme");

  const response = await request(app)
    .get("/api/users?q=findme")
    .set(...auth("searcher"))
    .expect(200);

  // Absent has to mean true, or adding the setting would have hidden everybody
  // who signed up before it existed.
  assert.equal(response.body.length, 1);
});

// ---------------------------------------------------------------------------
// Discovery filters
// ---------------------------------------------------------------------------

const deck = async (uid) => {
  const response = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth(uid))
    .expect(200);
  return response.body.candidates.map((entry) => entry.pet.name);
};

test("a weight range narrows the deck", async () => {
  const me = await makeUser("me", {
    discovery: { minWeight: 10, maxWeight: 30 },
  });
  await own(me, await makePet(me, { name: "Mine", weight: 20 }));

  const a = await makeUser("a");
  await own(a, await makePet(a, { name: "JustRight", weight: 25 }));
  const b = await makeUser("b");
  // Outside the filter but otherwise a strong match, so if it disappears it is
  // the setting that removed it and not the ranking.
  await own(b, await makePet(b, { name: "TooBig", weight: 80 }));

  const names = await deck("me");

  assert.ok(names.includes("JustRight"));
  assert.ok(!names.includes("TooBig"));
});

test("an age range narrows the deck", async () => {
  const me = await makeUser("me", { discovery: { minAge: 1, maxAge: 4 } });
  await own(me, await makePet(me, { name: "Mine", age: 3 }));

  const a = await makeUser("a");
  await own(a, await makePet(a, { name: "Young", age: 2 }));
  const b = await makeUser("b");
  await own(b, await makePet(b, { name: "Old", age: 12 }));

  const names = await deck("me");

  assert.ok(names.includes("Young"));
  assert.ok(!names.includes("Old"));
});

test("no preference means no filter, not an empty deck", async () => {
  const me = await makeUser("me");
  await own(me, await makePet(me, { name: "Mine" }));

  const a = await makeUser("a");
  await own(a, await makePet(a, { name: "Heavy", weight: 200 }));

  const names = await deck("me");

  assert.ok(names.includes("Heavy"));
});

test("the filters apply to the preview deck too", async () => {
  // Somebody browsing without a pet goes down a different code path, and
  // `reachableCandidates` is the one filter both share on purpose.
  await makeUser("me", { discovery: { maxWeight: 30 } });

  const a = await makeUser("a");
  await own(a, await makePet(a, { name: "Heavy", weight: 200 }));
  const b = await makeUser("b");
  await own(b, await makePet(b, { name: "Light", weight: 10 }));

  const response = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("me"))
    .expect(200);

  assert.equal(response.body.preview, true);
  const names = response.body.candidates.map((entry) => entry.pet.name);
  assert.ok(names.includes("Light"));
  assert.ok(!names.includes("Heavy"));
});

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

test("showOnMap: false keeps you off the map", async () => {
  const me = await makeUser("me");
  const mine = await own(me, await makePet(me, { name: "Mine" }));

  const shy = await makeUser("shy", { privacy: { showOnMap: false } });
  const theirs = await own(shy, await makePet(shy, { name: "Shy" }));

  await PetMatch.create({
    pet1: mine._id,
    pet2: theirs._id,
    relevantToUser: me._id,
    creator: me._id,
    matchScore: 80,
  });

  const response = await request(app)
    .get("/api/petmatches/map")
    .set(...auth("me"))
    .expect(200);

  const names = (response.body.pets ?? response.body).map?.((row) => row.name) ?? [];
  assert.ok(!names.includes("Shy"), "a map says where somebody is");
});

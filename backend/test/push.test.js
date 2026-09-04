const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const types = require("../services/notificationTypes");

/**
 * Notifications, end to end.
 *
 * There were three separate ways this failed at once.
 *
 * A mutual match stored two rows and emitted two socket events and sent no push
 * at all, so the one event in the app that both people have already said yes to
 * only reached somebody who happened to be holding their phone with the app
 * open.
 *
 * `readStatus` has been on the schema since the beginning, defaulting to false,
 * and nothing has ever set it to true: there was no mark-as-read endpoint and
 * no unread count, so the tab badge - which read a field the store does not
 * have - could only ever have counted up.
 *
 * And two call sites invoked `sendPushNotification(notificationData)` with the
 * recipient missing, handing Mongoose an object to cast to an ObjectId. Both
 * were inside the `Promise.all` of a create path, so sending a friend request
 * and cancelling a playdate were 500s on a line whose only job was to be
 * best-effort.
 */

let app;
let User;
let Pet;
let Notification;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Notification = require("../models/Notification");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  harness.firebaseStub.sent.length = 0;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = (uid, { token = `fcm-${uid}` } = {}) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    usernameLower: uid.toLowerCase(),
    email: `${uid}@example.test`,
    fcmToken: token,
  });

const givePet = (owner, name) =>
  Pet.create({
    name,
    breed: "Beagle",
    age: 3,
    weight: 20,
    energyLevel: "medium",
    owner: owner._id,
    creator: owner._id,
  });

const store = (recipient, overrides = {}) =>
  Notification.create({
    content: "Something happened",
    recipient: recipient._id,
    type: "general",
    ...overrides,
  });

// --- The push a match has to send ------------------------------------------

test("a mutual match pushes to both people, not just the one still looking", async () => {
  const alice = await signUp("push-alice");
  const bob = await signUp("push-bob");
  const alicePet = await givePet(alice, "Ada");
  const bobPet = await givePet(bob, "Bo");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("push-bob"))
    .send({ fromPetId: String(bobPet._id), toPetId: String(alicePet._id), decision: "like" })
    .expect(200);

  harness.firebaseStub.sent.length = 0;

  const res = await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("push-alice"))
    .send({ fromPetId: String(alicePet._id), toPetId: String(bobPet._id), decision: "like" })
    .expect(200);

  assert.equal(res.body.mutual, true);

  const tokens = harness.firebaseStub.sent.map((message) => message.token).sort();
  assert.deepEqual(tokens, ["fcm-push-alice", "fcm-push-bob"]);

  // The data carries the type and the pet, which is what decides where tapping
  // it lands. Every FCM data value has to be a string.
  for (const message of harness.firebaseStub.sent) {
    assert.equal(message.data.type, "petMatch");
    assert.equal(typeof message.data.petId, "string");
    assert.match(message.notification.body, /matched/i);
  }
});

test("a stored row accompanies every push, so it survives a phone that was off", async () => {
  const alice = await signUp("row-alice");
  const bob = await signUp("row-bob");
  const alicePet = await givePet(alice, "Ada");
  const bobPet = await givePet(bob, "Bo");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("row-bob"))
    .send({ fromPetId: String(bobPet._id), toPetId: String(alicePet._id), decision: "like" })
    .expect(200);
  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("row-alice"))
    .send({ fromPetId: String(alicePet._id), toPetId: String(bobPet._id), decision: "like" })
    .expect(200);

  const stored = await Notification.find({ type: "petMatch" }).lean();
  assert.equal(stored.length, 2);
});

test("no device token is not an error - the row is still written", async () => {
  const alice = await signUp("quiet-alice", { token: null });
  const bob = await signUp("quiet-bob", { token: null });
  const alicePet = await givePet(alice, "Ada");
  const bobPet = await givePet(bob, "Bo");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("quiet-bob"))
    .send({ fromPetId: String(bobPet._id), toPetId: String(alicePet._id), decision: "like" })
    .expect(200);
  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth("quiet-alice"))
    .send({ fromPetId: String(alicePet._id), toPetId: String(bobPet._id), decision: "like" })
    .expect(200);

  assert.equal(harness.firebaseStub.sent.length, 0);
  assert.equal(await Notification.countDocuments({ type: "petMatch" }), 2);
});

// --- Read state -------------------------------------------------------------

test("unread starts at what was written and drops to zero when read", async () => {
  const me = await signUp("unread-me");
  await store(me);
  await store(me);

  const before = await request(app)
    .get("/api/notifications/unread-count")
    .set(...auth("unread-me"))
    .expect(200);
  assert.equal(before.body.unread, 2);

  await request(app)
    .post("/api/notifications/read")
    .set(...auth("unread-me"))
    .expect(200);

  const after = await request(app)
    .get("/api/notifications/unread-count")
    .set(...auth("unread-me"))
    .expect(200);
  assert.equal(after.body.unread, 0);
});

test("one notification can be marked read on its own", async () => {
  const me = await signUp("one-read-me");
  const first = await store(me);
  await store(me);

  await request(app)
    .post(`/api/notifications/${first._id}/read`)
    .set(...auth("one-read-me"))
    .expect(200);

  const count = await request(app)
    .get("/api/notifications/unread-count")
    .set(...auth("one-read-me"))
    .expect(200);
  assert.equal(count.body.unread, 1);
});

test("the count is the caller's own, not everybody's", async () => {
  const me = await signUp("count-me");
  const them = await signUp("count-them");
  await store(me);
  await store(them);
  await store(them);

  const res = await request(app)
    .get("/api/notifications/unread-count")
    .set(...auth("count-me"))
    .expect(200);

  assert.equal(res.body.unread, 1);
});

test("somebody else's notification cannot be marked read", async () => {
  await signUp("mark-me");
  const them = await signUp("mark-them");
  const theirs = await store(them);

  await request(app)
    .post(`/api/notifications/${theirs._id}/read`)
    .set(...auth("mark-me"))
    .expect(404);

  const after = await Notification.findById(theirs._id).lean();
  assert.equal(after.readStatus, false);
});

// --- Reading somebody else's list ------------------------------------------

test("the by-user list refuses an id that is not the caller's", async () => {
  await signUp("list-me");
  const them = await signUp("list-them");
  await store(them, { content: "Private" });

  // The id came from the URL and was used unchecked: any signed-in account
  // could read anybody's notifications by putting their id in the path.
  await request(app)
    .get(`/api/notifications/user/${them._id}`)
    .set(...auth("list-me"))
    .expect(403);
});

test("the by-user list returns the caller's own, newest first", async () => {
  const me = await signUp("mine-me");
  await store(me, { content: "Older", timestamp: new Date("2025-01-01") });
  await store(me, { content: "Newer", timestamp: new Date("2025-06-01") });

  const res = await request(app)
    .get(`/api/notifications/user/${me._id}`)
    .set(...auth("mine-me"))
    .expect(200);

  assert.equal(res.body.length, 2);
  assert.equal(res.body[0].content, "Newer");
});

test("recent asks for the right field, so it is not empty by construction", async () => {
  const me = await signUp("recent-me");
  await store(me, { content: "Just now" });
  await store(me, { content: "Last week", timestamp: new Date(Date.now() - 8 * 86400000) });

  const res = await request(app)
    .get("/api/notifications/recent")
    .set(...auth("recent-me"))
    .expect(200);

  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].content, "Just now");
});

// --- The two call sites that always threw -----------------------------------

test("sending a friend request succeeds and pushes", async () => {
  const sender = await signUp("fr-sender");
  const receiver = await signUp("fr-receiver");
  await givePet(sender, "Ada");
  await givePet(receiver, "Bo");

  // `sendPushNotification(notificationData)` passed the payload where the
  // recipient goes, and the resulting cast error made this a 400 every time.
  await request(app)
    .post("/api/friendrequests")
    .set(...auth("fr-sender"))
    .send({ receiver: String(receiver._id) })
    .expect(201);

  const pushed = harness.firebaseStub.sent.find(
    (message) => message.token === "fcm-fr-receiver"
  );
  assert.ok(pushed, "the receiver was never pushed");
  assert.equal(pushed.data.type, "friendRequest");
  assert.equal(pushed.data.requesterId, String(sender._id));
});

// --- The type table ---------------------------------------------------------

test("every type names a screen, and legacy values still resolve", async () => {
  for (const [name, entry] of Object.entries(types.TYPES)) {
    assert.ok(entry.title, `${name} has no push title`);
    assert.ok(entry.screen, `${name} has nowhere to go`);
  }

  // Rows written before the table existed keep their old strings; dropping
  // them would empty somebody's list on upgrade.
  assert.equal(types.normalise("DirectMessage"), "message");
  assert.equal(types.normalise("Playdate Cancelled"), "playdateCancelled");
  assert.equal(types.normalise("petMatch"), "petMatch");
  // Anything unrecognised still routes somewhere rather than nowhere.
  assert.equal(types.normalise("something we stopped sending"), "general");
});

test("a destination carries the one param its screen reads", async () => {
  assert.deepEqual(types.destinationFor("petMatch", { petId: "abc" }), [
    "PetDetails",
    { petId: "abc" },
  ]);
  // A param the screen does not read is dropped rather than passed through.
  assert.deepEqual(types.destinationFor("petMatch", { chatId: "abc" }), [
    "PetDetails",
    {},
  ]);
});

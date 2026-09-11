const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let models;

/**
 * Deleting an account deletes what it owns.
 *
 * `DELETE /api/users/me` used to remove the `User` row and the Firebase login
 * and leave everything else - pets, photos, messages, playdates, health
 * records - under an owner id that no longer resolved. Both stores require the
 * associated data to go too, and the privacy policy says it does. These tests
 * seed one of everything, delete the account, and check each collection; the
 * last one reads the service's source so a model added tomorrow has to be
 * either cascaded or named in `RETAINED`.
 */
test.before(async () => {
  app = await harness.start();
  models = {
    User: require("../models/User"),
    Pet: require("../models/Pet"),
    HealthRecord: require("../models/HealthRecord"),
    Favorite: require("../models/Favorite"),
    Friend: require("../models/Friend"),
    FriendRequest: require("../models/FriendRequest"),
    Notification: require("../models/Notification"),
    Chat: require("../models/Chat"),
    GroupChat: require("../models/GroupChat"),
    Message: require("../models/Message"),
    Playdate: require("../models/Playdate"),
    Report: require("../models/Report"),
    Location: require("../models/Location"),
    UserPreferences: require("../models/UserPreferences"),
  };
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  harness.firebaseStub.deletedFiles.length = 0;
  harness.firebaseStub.deletedUsers.length = 0;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwnerWithPet = async (uid) => {
  const user = await models.User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await models.Pet.create({
    name: `${uid}-pet`,
    weight: 30,
    breed: "Labrador",
    age: 3,
    owner: user._id,
    creator: user._id,
  });
  await models.User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { user, pet };
};

/** Alice and Bob, connected every way the app allows. */
const seedWorld = async () => {
  const alice = await makeOwnerWithPet("alice");
  const bob = await makeOwnerWithPet("bob");

  // A conversation, through the API so it carries the real shape.
  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("alice"))
    .send({ petId: String(bob.pet._id) })
    .expect((res) => assert.ok([200, 201].includes(res.status), JSON.stringify(res.body)));
  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("alice"))
    .send({ chatId: chat.body._id, text: "park at 5?" })
    .expect(201);

  await models.HealthRecord.create({
    pet: alice.pet._id,
    owner: alice.user._id,
    kind: "rabies",
    administeredAt: new Date(),
    creator: alice.user._id,
  });
  // Favourites through the API too: the pet lives in `content`, and the
  // model's exactly-one-target rule is easier to satisfy than to imitate.
  await request(app).post("/api/favorites").set(...auth("alice")).send({ content: String(bob.pet._id) }).expect(201);
  await request(app).post("/api/favorites").set(...auth("bob")).send({ content: String(alice.pet._id) }).expect(201);
  await models.Friend.create({ user1: alice.user._id, user2: bob.user._id, creator: alice.user._id });
  await models.User.updateOne({ _id: bob.user._id }, { $push: { friendsList: alice.user._id } });
  await models.FriendRequest.create({ sender: bob.user._id, receiver: alice.user._id });
  await models.Notification.create({
    content: "Bo likes Rex",
    recipient: alice.user._id,
    type: "petMatch",
    creator: bob.user._id,
  });
  await models.UserPreferences.create({ user: alice.user._id });

  const { REPORT_REASONS, REPORT_TARGETS } = require("../services/reportStates");
  await models.Report.create({
    content: "Was rude at the park",
    reportedContent: alice.pet._id,
    reportedContentType: REPORT_TARGETS[0],
    reporter: bob.user._id,
    reportedUser: alice.user._id,
    reason: REPORT_REASONS[0],
    creator: bob.user._id,
  });

  return { alice, bob, chatId: chat.body._id };
};

test("deleting an account removes everything it owns and leaves the other person's things", async () => {
  const { alice, bob, chatId } = await seedWorld();

  await request(app).delete("/api/users/me").set(...auth("alice")).expect(200);

  const a = alice.user._id;
  assert.equal(await models.User.countDocuments({ _id: a }), 0);
  assert.equal(await models.Pet.countDocuments({ owner: a }), 0);
  assert.equal(await models.HealthRecord.countDocuments({ owner: a }), 0);
  assert.equal(await models.Favorite.countDocuments({ user: a }), 0);
  // Bob's favourite *of Alice's pet* points at nothing now, so it goes too.
  assert.equal(await models.Favorite.countDocuments({ content: alice.pet._id }), 0);
  assert.equal(await models.Friend.countDocuments({ $or: [{ user1: a }, { user2: a }] }), 0);
  assert.equal(await models.FriendRequest.countDocuments({ receiver: a }), 0);
  assert.equal(await models.Notification.countDocuments({ recipient: a }), 0);
  assert.equal(await models.UserPreferences.countDocuments({ user: a }), 0);
  assert.equal(await models.Chat.countDocuments({ _id: chatId }), 0);
  assert.equal(await models.Message.countDocuments({ chat: chatId }), 0);

  // Bob is untouched apart from the reference to Alice.
  assert.equal(await models.User.countDocuments({ _id: bob.user._id }), 1);
  assert.equal(await models.Pet.countDocuments({ owner: bob.user._id }), 1);
  const bobAfter = await models.User.findById(bob.user._id).lean();
  assert.ok(!bobAfter.friendsList.map(String).includes(String(a)));

  // The report about her stays, for moderation across accounts.
  assert.equal(await models.Report.countDocuments({ reportedUser: a }), 1);

  // The login and the photos went with the account.
  assert.deepEqual(harness.firebaseStub.deletedUsers, ["alice"]);
  assert.deepEqual(harness.firebaseStub.deletedFiles, ["alice"]);
});

test("a playdate she organised is cancelled; one she was invited to loses her invitation", async () => {
  const alice = await makeOwnerWithPet("alice");
  const bob = await makeOwnerWithPet("bob");
  const when = new Date(Date.now() + 86400000);
  const park = await models.Location.create({
    name: "Dolores Park",
    address: "Dolores St, San Francisco",
    placeId: "place-dolores",
  });

  const hers = await models.Playdate.create({
    date: when,
    startTime: when,
    location: park._id,
    creator: alice.user._id,
    participants: [alice.user._id, bob.user._id],
    petsInvolved: [alice.pet._id, bob.pet._id],
  });
  const his = await models.Playdate.create({
    date: when,
    startTime: when,
    location: park._id,
    creator: bob.user._id,
    participants: [bob.user._id, alice.user._id],
    petsInvolved: [bob.pet._id, alice.pet._id],
  });

  await request(app).delete("/api/users/me").set(...auth("alice")).expect(200);

  assert.equal(await models.Playdate.countDocuments({ _id: hers._id }), 0);
  const remaining = await models.Playdate.findById(his._id).lean();
  assert.ok(remaining, "the other organiser keeps their playdate");
  assert.deepEqual(remaining.participants.map(String), [String(bob.user._id)]);
  assert.deepEqual(remaining.petsInvolved.map(String), [String(bob.pet._id)]);
});

test("a group she was in carries on without her; a group only she was in goes", async () => {
  const alice = await makeOwnerWithPet("alice");
  const bob = await makeOwnerWithPet("bob");

  const shared = await models.GroupChat.create({
    groupName: "Park crew",
    chatId: "group-shared",
    participants: [alice.user._id, bob.user._id],
    creator: bob.user._id,
  });
  const solo = await models.GroupChat.create({
    groupName: "Just me",
    chatId: "group-solo",
    participants: [alice.user._id],
    creator: alice.user._id,
  });

  await request(app).delete("/api/users/me").set(...auth("alice")).expect(200);

  const after = await models.GroupChat.findById(shared._id).lean();
  assert.deepEqual(after.participants.map(String), [String(bob.user._id)]);
  assert.equal(await models.GroupChat.countDocuments({ _id: solo._id }), 0);
});

test("every model that references a user is either cascaded or deliberately retained", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../services/accountDeletion.js"), "utf8");
  const { RETAINED } = require("../services/accountDeletion");
  const modelsDir = path.resolve(__dirname, "../models");

  const missing = [];
  for (const file of fs.readdirSync(modelsDir)) {
    const name = path.basename(file, ".js");
    const text = fs.readFileSync(path.join(modelsDir, file), "utf8");
    if (!/ref:\s*"User"/.test(text) || name === "User") continue;
    // Pet is a discriminator of Content and is cascaded under its own name.
    if (name === "Content") continue;
    const handled = new RegExp(`require\\("\\.\\./models/${name}"\\)`).test(source);
    if (!handled && !RETAINED.includes(name)) missing.push(name);
  }

  assert.deepEqual(
    missing,
    [],
    `models referencing a user that account deletion neither removes nor lists as retained: ${missing.join(", ")}`
  );
});

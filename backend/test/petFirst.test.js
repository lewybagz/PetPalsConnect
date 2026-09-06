const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Chat;
let Friend;
let FriendRequest;
let Notification;

/**
 * The pet is the subject.
 *
 * This app is for arranging for two animals to meet, and it used to model
 * almost all of that as a relationship between two accounts. A conversation
 * was keyed by the pair of *owners* and recorded a single pet - whichever one
 * the caller happened to tap - so somebody with three dogs had one thread with
 * you no matter which dog either of you meant. A friendship named two people
 * and no animals at all.
 *
 * What stays owner-shaped is everything about safety and identity: blocking,
 * suspension, audience settings and the scoping of every read. You do not
 * block a dog. These tests exist to hold both halves of that at once.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Chat = require("../models/Chat");
  Friend = require("../models/Friend");
  FriendRequest = require("../models/FriendRequest");
  Notification = require("../models/Notification");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const owner = async (uid, petNames = [`${uid}-pet`]) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pets = [];
  for (const name of petNames) {
    const pet = await Pet.create({
      name,
      weight: 30,
      breed: "Labrador",
      age: 3,
      owner: user._id,
      creator: user._id,
    });
    pets.push(pet);
    user.pets.push(pet._id);
  }
  await user.save();
  return { user, pets, pet: pets[0] };
};

// --- Chats are between two pets ------------------------------------------

test("a conversation records both pets, not just the one that opened it", async () => {
  const alice = await owner("chat-alice");
  const bob = await owner("chat-bob");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("chat-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const stored = await Chat.findById(res.body._id).lean();
  const pets = stored.pets.map(String).sort();
  assert.deepEqual(pets, [String(alice.pet._id), String(bob.pet._id)].sort());
});

test("two of your pets talking to one person are two conversations", async () => {
  const me = await owner("multi-me", ["Bo", "Rex"]);
  const them = await owner("multi-them");

  const first = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("multi-me"))
    .send({ petId: String(them.pet._id), myPetId: String(me.pets[0]._id) })
    .expect(200);

  const second = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("multi-me"))
    .send({ petId: String(them.pet._id), myPetId: String(me.pets[1]._id) })
    .expect(200);

  // The old key was the sorted pair of owner ids, so these were one thread and
  // the pet on it was whichever dog spoke first.
  assert.notEqual(first.body._id, second.body._id);
  assert.notEqual(first.body.chatId, second.body.chatId);

  const inbox = await request(app)
    .get("/api/chats")
    .set(...auth("multi-me"))
    .expect(200);
  assert.equal(inbox.body.length, 2);
});

test("the same pet pair is always the same conversation, from either side", async () => {
  const alice = await owner("same-alice");
  const bob = await owner("same-bob");

  const fromAlice = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("same-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const fromBob = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("same-bob"))
    .send({ petId: String(alice.pet._id) })
    .expect(200);

  assert.equal(fromAlice.body._id, fromBob.body._id);
});

test("with more than one pet you have to say which one is talking", async () => {
  await owner("ask-me", ["Bo", "Rex"]);
  const them = await owner("ask-them");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("ask-me"))
    .send({ petId: String(them.pet._id) })
    .expect(400);

  assert.match(res.body.message, /myPetId/);
});

test("you cannot start a conversation as somebody else's pet", async () => {
  await owner("imposter");
  const them = await owner("victim");
  const third = await owner("bystander");

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("imposter"))
    .send({ petId: String(them.pet._id), myPetId: String(third.pet._id) })
    .expect(403);
});

test("a message notification names both pets", async () => {
  const alice = await owner("msg-alice", ["Bo"]);
  const bob = await owner("msg-bob", ["Sky"]);

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("msg-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("msg-alice"))
    .send({ chatId: chat.body._id, text: "woof" })
    .expect(201);

  const notification = await Notification.findOne({ recipient: bob.user._id }).lean();
  assert.equal(notification.content, "Bo sent Sky a message.");
  void alice;
});

// --- Friendships are between two pets ------------------------------------

test("a friend request records the pet asking and the pet being asked", async () => {
  const alice = await owner("fr-alice", ["Bo"]);
  const bob = await owner("fr-bob", ["Sky"]);

  const res = await request(app)
    .post("/api/friendrequests")
    .set(...auth("fr-alice"))
    .send({ receiver: String(bob.user._id) })
    .expect(201);

  const stored = await FriendRequest.findById(res.body._id).lean();
  assert.equal(String(stored.senderPet), String(alice.pet._id));
  assert.equal(String(stored.receiverPet), String(bob.pet._id));

  const notification = await Notification.findOne({ recipient: bob.user._id }).lean();
  assert.match(notification.content, /Bo wants to be pals with Sky/);
});

test("a request names the pets the sender chose, when they have several", async () => {
  const alice = await owner("pick-alice", ["Bo", "Rex"]);
  const bob = await owner("pick-bob", ["Sky", "Nell"]);

  const res = await request(app)
    .post("/api/friendrequests")
    .set(...auth("pick-alice"))
    .send({
      receiver: String(bob.user._id),
      senderPet: String(alice.pets[1]._id),
      receiverPet: String(bob.pets[1]._id),
    })
    .expect(201);

  const stored = await FriendRequest.findById(res.body._id).lean();
  assert.equal(String(stored.senderPet), String(alice.pets[1]._id));
  assert.equal(String(stored.receiverPet), String(bob.pets[1]._id));
});

test("you cannot send a request as a pet that is not yours", async () => {
  await owner("claim-alice");
  const bob = await owner("claim-bob");
  const third = await owner("claim-third");

  await request(app)
    .post("/api/friendrequests")
    .set(...auth("claim-alice"))
    .send({ receiver: String(bob.user._id), senderPet: String(third.pet._id) })
    .expect(403);
});

test("accepting makes the two pets pals, in the right order", async () => {
  const alice = await owner("ac-alice", ["Bo"]);
  const bob = await owner("ac-bob", ["Sky"]);

  const created = await request(app)
    .post("/api/friendrequests")
    .set(...auth("ac-alice"))
    .send({ receiver: String(bob.user._id) })
    .expect(201);

  await request(app)
    .put(`/api/friendrequests/${created.body._id}/accept`)
    .set(...auth("ac-bob"))
    .expect(200);

  const friendship = await Friend.findOne({ status: true }).lean();
  assert.ok(friendship, "no friendship was created");

  // `pairFor` sorts the two owners, so the pets have to be attached by owner
  // rather than positionally - otherwise whichever way the sort fell decided
  // whose dog was recorded as whose.
  const petForUser = (userId) =>
    String(friendship.user1) === String(userId)
      ? String(friendship.pet1)
      : String(friendship.pet2);

  assert.equal(petForUser(alice.user._id), String(alice.pet._id));
  assert.equal(petForUser(bob.user._id), String(bob.pet._id));
});

test("the acceptance notification names the accepting pet, not the asker's own", async () => {
  const alice = await owner("nm-alice", ["Bo"]);
  const bob = await owner("nm-bob", ["Sky"]);

  const created = await request(app)
    .post("/api/friendrequests")
    .set(...auth("nm-alice"))
    .send({ receiver: String(bob.user._id) })
    .expect(201);

  await request(app)
    .put(`/api/friendrequests/${created.body._id}/accept`)
    .set(...auth("nm-bob"))
    .expect(200);

  const notification = await Notification.findOne({
    recipient: alice.user._id,
    type: "friendAccepted",
  }).lean();

  // It read `requester.pets[0].name` - the *asker's* pet - so Bo's owner was
  // told that Bo had accepted their own request.
  assert.match(notification.content, /Sky and Bo are now pals/);
});

// --- Groups are groups of pets -------------------------------------------

test("a group records the pets it is a group of", async () => {
  const alice = await owner("grp-alice", ["Bo"]);
  const bob = await owner("grp-bob", ["Sky"]);

  const res = await request(app)
    .post("/api/groupchats")
    .set(...auth("grp-alice"))
    .send({
      groupName: "Park Crew",
      participants: [String(bob.user._id)],
      pets: [String(alice.pet._id), String(bob.pet._id)],
    })
    .expect(201);

  assert.deepEqual(
    (res.body.pets ?? []).map(String).sort(),
    [String(alice.pet._id), String(bob.pet._id)].sort()
  );
});

// --- What must stay about people -----------------------------------------

test("blocking still refuses before anything about pets is decided", async () => {
  const me = await owner("blk-me");
  const them = await owner("blk-them");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("blk-me"))
    .send({ blockedUser: String(them.user._id) })
    .expect(201);

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("blk-them"))
    .send({ petId: String(me.pet._id) })
    .expect(403);

  // The refusal must not vary with anything else about the caller, or the
  // difference is itself a signal to somebody who has been blocked.
  assert.doesNotMatch(res.body.message, /block/i);
  assert.doesNotMatch(res.body.message, /pet/i);
});

test("a blocked caller with no pet gets the same answer as one with a pet", async () => {
  const me = await owner("same-me");
  const them = await User.create({
    firebaseUid: "petless",
    username: "petless",
    email: "petless@example.test",
  });

  await request(app)
    .post("/api/blocklists")
    .set(...auth("same-me"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("petless"))
    .send({ petId: String(me.pet._id) })
    .expect(403);

  assert.doesNotMatch(res.body.message, /pet/i);
});

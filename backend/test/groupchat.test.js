const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

/**
 * Group chats, and who is allowed to touch one.
 *
 * `getAllGroupChats` was scoped to the caller, so the audit was satisfied and
 * the rest of the file was never looked at again. Every other handler took a
 * group id from the request and stopped there: reading a group's whole message
 * history, archiving it, muting it, posting media into it and removing a member
 * all worked on any group in the database.
 *
 * `leaveGroup` was the worst of them - `chat.participants.pull(userId)` with
 * `userId` from the body - which is "remove anybody from any group chat" to
 * any signed-in account.
 *
 * Two of the three were also unusable rather than merely unsafe: `toggleMute`
 * read `chat.UserSettings`, which is not a path on the schema, so it threw on
 * every call; and `participants` was declared `ref: "Pet"` while every query
 * treats them as users, so populating them resolved user ids against the pet
 * collection and produced nulls.
 */

let app;
let User;
let GroupChat;
let Message;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  GroupChat = require("../models/GroupChat");
  Message = require("../models/Message");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  harness.firebaseStub.sent.length = 0;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = (uid) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    usernameLower: uid.toLowerCase(),
    email: `${uid}@example.test`,
    fcmToken: `fcm-${uid}`,
  });

const makeGroup = async (name, members) =>
  GroupChat.create({
    groupName: name,
    participants: members.map((member) => member._id),
    creator: members[0]._id,
  });

// --- Membership -------------------------------------------------------------

test("an outsider cannot read a group's messages", async () => {
  const alice = await signUp("gc-alice");
  const bob = await signUp("gc-bob");
  await signUp("gc-nosy");
  const group = await makeGroup("Park regulars", [alice, bob]);

  await Message.create({
    chat: group._id,
    sender: alice._id,
    creator: alice._id,
    contentText: "See you at four",
  });

  await request(app)
    .get(`/api/groupchats/${group._id}/details`)
    .set(...auth("gc-nosy"))
    .expect(404);
});

test("a member reads the group with its participants filled in", async () => {
  const alice = await signUp("gc-in-alice");
  const bob = await signUp("gc-in-bob");
  const group = await makeGroup("Beagle club", [alice, bob]);

  const res = await request(app)
    .get(`/api/groupchats/${group._id}/details`)
    .set(...auth("gc-in-alice"))
    .expect(200);

  // `ref: "Pet"` on a list of user ids populated to nulls, so the details
  // screen showed a group with nobody in it.
  assert.equal(res.body.participants.length, 2);
  assert.ok(res.body.participants.every((participant) => participant.username));
});

test("an outsider cannot archive somebody else's group", async () => {
  const alice = await signUp("arch-alice");
  const bob = await signUp("arch-bob");
  await signUp("arch-nosy");
  const group = await makeGroup("Sunday walk", [alice, bob]);

  await request(app)
    .post(`/api/groupchats/${group._id}/archive`)
    .set(...auth("arch-nosy"))
    .expect(404);

  const after = await GroupChat.findById(group._id).lean();
  assert.equal(after.isArchived, false);
});

// --- Leaving ----------------------------------------------------------------

test("leaving removes you and nobody else", async () => {
  const alice = await signUp("leave-alice");
  const bob = await signUp("leave-bob");
  const group = await makeGroup("Leavers", [alice, bob]);

  await request(app)
    .post("/api/groupchats/leave")
    .set(...auth("leave-bob"))
    .send({ chatId: String(group._id) })
    .expect(200);

  const after = await GroupChat.findById(group._id).lean();
  assert.deepEqual(
    after.participants.map(String),
    [String(alice._id)]
  );
});

test("you cannot remove somebody else from a group", async () => {
  const alice = await signUp("kick-alice");
  const bob = await signUp("kick-bob");
  await signUp("kick-nosy");
  const group = await makeGroup("Kickers", [alice, bob]);

  // This used to take `userId` from the body with nothing checking it.
  await request(app)
    .post("/api/groupchats/leave")
    .set(...auth("kick-nosy"))
    .send({ chatId: String(group._id), userId: String(alice._id) })
    .expect(404);

  const after = await GroupChat.findById(group._id).lean();
  assert.equal(after.participants.length, 2);
});

// --- Muting -----------------------------------------------------------------

test("muting a group is per person and actually saves", async () => {
  const alice = await signUp("mute-alice");
  const bob = await signUp("mute-bob");
  const group = await makeGroup("Noisy", [alice, bob]);

  const res = await request(app)
    .put("/api/groupchats/toggle-mute")
    .set(...auth("mute-alice"))
    .send({ chatId: String(group._id), mute: true })
    .expect(200);
  assert.equal(res.body.muted, true);

  const after = await GroupChat.findById(group._id).lean();
  assert.deepEqual(after.mutedBy.map(String), [String(alice._id)]);

  await request(app)
    .put("/api/groupchats/toggle-mute")
    .set(...auth("mute-alice"))
    .send({ chatId: String(group._id), mute: false })
    .expect(200);

  const unmuted = await GroupChat.findById(group._id).lean();
  assert.deepEqual(unmuted.mutedBy, []);
});

test("an outsider cannot mute a group they are not in", async () => {
  const alice = await signUp("mute-out-alice");
  const bob = await signUp("mute-out-bob");
  await signUp("mute-out-nosy");
  const group = await makeGroup("Private", [alice, bob]);

  await request(app)
    .put("/api/groupchats/toggle-mute")
    .set(...auth("mute-out-nosy"))
    .send({ chatId: String(group._id), mute: true })
    .expect(404);
});

// --- Reacting ---------------------------------------------------------------

test("a reaction notifies the other members and is attributed to the caller", async () => {
  const alice = await signUp("react-alice");
  const bob = await signUp("react-bob");
  const group = await makeGroup("Reactors", [alice, bob]);
  const message = await Message.create({
    chat: group._id,
    sender: alice._id,
    creator: alice._id,
    contentText: "Look at this",
  });

  await request(app)
    .post("/api/groupchats/react")
    .set(...auth("react-bob"))
    // `reactorId` used to come from the body, so a reaction could be
    // attributed to anybody.
    .send({
      groupId: String(group._id),
      messageId: String(message._id),
      reaction: "❤️",
      reactorId: String(alice._id),
    })
    .expect(200);

  const pushed = harness.firebaseStub.sent;
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].token, "fcm-react-alice");
  assert.equal(pushed[0].data.type, "messageReaction");
});

// --- Creating ---------------------------------------------------------------

test("creating a group puts the creator in it", async () => {
  const alice = await signUp("make-alice");
  const bob = await signUp("make-bob");

  const res = await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("make-alice"))
    .send({ groupName: "Dog park", participants: [String(bob._id)] })
    .expect(200);

  // Left out of their own group, the creator never saw it: `getAllGroupChats`
  // filters on participants.
  assert.deepEqual(
    res.body.participants.map(String).sort(),
    [String(alice._id), String(bob._id)].sort()
  );

  const mine = await request(app)
    .get("/api/groupchats")
    .set(...auth("make-alice"))
    .expect(200);
  assert.equal(mine.body.length, 1);
});

test("the same set of people finds the same group, whoever asks", async () => {
  const alice = await signUp("same-alice");
  const bob = await signUp("same-bob");

  const first = await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("same-alice"))
    .send({ groupName: "Walkers", participants: [String(bob._id)] })
    .expect(200);

  const second = await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("same-bob"))
    .send({ groupName: "Walkers", participants: [String(alice._id)] })
    .expect(200);

  assert.equal(String(first.body._id), String(second.body._id));
  assert.equal(await GroupChat.countDocuments({}), 1);
});

test("two unrelated groups can share a name", async () => {
  await signUp("name-alice");
  const bob = await signUp("name-bob");
  const carol = await signUp("name-carol");

  await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("name-alice"))
    .send({ groupName: "Dog park", participants: [String(bob._id)] })
    .expect(200);

  // `groupName` was `unique: true`, so the second set of friends could not
  // name their group the same thing.
  await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("name-alice"))
    .send({ groupName: "Dog park", participants: [String(carol._id)] })
    .expect(200);

  assert.equal(await GroupChat.countDocuments({}), 2);
});

test("a group of one is refused", async () => {
  await signUp("solo");

  await request(app)
    .post("/api/groupchats/findOrCreate")
    .set(...auth("solo"))
    .send({ groupName: "Just me", participants: [] })
    .expect(400);
});

test("only the creator can delete a group", async () => {
  const alice = await signUp("del-alice");
  const bob = await signUp("del-bob");
  const group = await makeGroup("Deletable", [alice, bob]);

  await request(app)
    .delete(`/api/groupchats/${group._id}`)
    .set(...auth("del-bob"))
    .expect(404);

  await request(app)
    .delete(`/api/groupchats/${group._id}`)
    .set(...auth("del-alice"))
    .expect(200);

  assert.equal(await GroupChat.countDocuments({}), 0);
});

test("an outsider cannot react in a group they are not in", async () => {
  const alice = await signUp("react-out-alice");
  const bob = await signUp("react-out-bob");
  await signUp("react-out-nosy");
  const group = await makeGroup("Closed", [alice, bob]);
  const message = await Message.create({
    chat: group._id,
    sender: alice._id,
    creator: alice._id,
    contentText: "Hello",
  });

  await request(app)
    .post("/api/groupchats/react")
    .set(...auth("react-out-nosy"))
    .send({
      groupId: String(group._id),
      messageId: String(message._id),
      reaction: "❤️",
    })
    .expect(403);
});

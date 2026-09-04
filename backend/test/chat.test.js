const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Chat;
let Message;
let realtime;

/**
 * Direct messaging.
 *
 * `findOrCreateChat` read `userId` from the request body and created the chat
 * with `participants: [userId]` - just the caller. The pet's owner was never a
 * participant, so `getUserChats` never showed them the thread and `sendMessage`
 * (which resolves "the participant who is not me") never found a recipient:
 * no receiver on the message, no notification, no socket push. Two people could
 * not have a conversation.
 *
 * The key was also `SHA256(userId-petId)`, which is asymmetric: A messaging B's
 * pet and B messaging A's pet opened two separate threads.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Chat = require("../models/Chat");
  Message = require("../models/Message");
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
    weight: 30,
    breed: "Labrador",
    age: 3,
    owner: user._id,
    creator: user._id,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { user, pet };
};

test("starting a chat puts both people in it", async () => {
  const alice = await makeOwnerWithPet("chat-alice");
  const bob = await makeOwnerWithPet("chat-bob");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("chat-alice"))
    .send({ petId: String(bob.pet._id) });

  assert.equal(res.status, 200, JSON.stringify(res.body));

  const stored = await Chat.findById(res.body._id).lean();
  const participants = stored.participants.map(String).sort();
  assert.deepEqual(
    participants,
    [String(alice.user._id), String(bob.user._id)].sort(),
    "the pet's owner must be a participant or they never see the chat"
  );
});

test("both directions land in the same conversation", async () => {
  const alice = await makeOwnerWithPet("sym-alice");
  const bob = await makeOwnerWithPet("sym-bob");

  const first = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("sym-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const second = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("sym-bob"))
    .send({ petId: String(alice.pet._id) })
    .expect(200);

  assert.equal(first.body._id, second.body._id);
  assert.equal(await Chat.countDocuments({}), 1);
});

test("the caller comes from the token, not the body", async () => {
  const alice = await makeOwnerWithPet("id-alice");
  const bob = await makeOwnerWithPet("id-bob");
  const mallory = await makeOwnerWithPet("id-mallory");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("id-alice"))
    // A body-supplied id used to decide who the chat belonged to.
    .send({ petId: String(bob.pet._id), userId: String(mallory.user._id) })
    .expect(200);

  const stored = await Chat.findById(res.body._id).lean();
  const participants = stored.participants.map(String);
  assert.ok(participants.includes(String(alice.user._id)));
  assert.ok(!participants.includes(String(mallory.user._id)));
});

test("you cannot open a chat with yourself", async () => {
  const alice = await makeOwnerWithPet("self-alice");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("self-alice"))
    .send({ petId: String(alice.pet._id) });

  assert.equal(res.status, 400);
});

test("an unknown pet is a 404, not a chat with one participant", async () => {
  await makeOwnerWithPet("missing-alice");
  const mongoose = require("mongoose");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("missing-alice"))
    .send({ petId: String(new mongoose.Types.ObjectId()) });

  assert.equal(res.status, 404);
  assert.equal(await Chat.countDocuments({}), 0);
});

test("a sent message reaches the other participant", async () => {
  const alice = await makeOwnerWithPet("send-alice");
  const bob = await makeOwnerWithPet("send-bob");
  const emitted = [];
  realtime.setIO({
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  });

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("send-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const res = await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("send-alice"))
    .send({ chatId: chat.body._id, text: "Fancy a walk?" });

  assert.equal(res.status, 201, JSON.stringify(res.body));

  const stored = await Message.findOne({ chat: chat.body._id }).lean();
  assert.equal(stored.contentText, "Fancy a walk?");
  assert.equal(String(stored.sender), String(alice.user._id));
  assert.equal(
    String(stored.receiver),
    String(bob.user._id),
    "with one participant there was no recipient to address"
  );

  const message = emitted.find((e) => e.event === "message");
  assert.ok(message, "the recipient should be pushed the message");
  assert.equal(message.room, String(bob.user._id));
});

test("the recipient gets a notification they can actually read", async () => {
  const Notification = require("../models/Notification");
  await makeOwnerWithPet("notify-alice");
  const bob = await makeOwnerWithPet("notify-bob");

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("notify-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("notify-alice"))
    .send({ chatId: chat.body._id, text: "Hello" })
    .expect(201);

  const notification = await Notification.findOne({ recipient: bob.user._id }).lean();
  assert.ok(notification, "no notification reached the recipient");
  assert.match(notification.content, /sent you a message/i);
  // The type is what decides where tapping it goes, so it has to be one the
  // app knows - not a free string invented at the call site.
  assert.equal(notification.type, "message");
});

test("the chat shows up for both people", async () => {
  await makeOwnerWithPet("list-alice");
  const bob = await makeOwnerWithPet("list-bob");

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("list-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const bobsChats = await request(app).get("/api/chats").set(...auth("list-bob")).expect(200);

  assert.equal(bobsChats.body.length, 1);
});

// --- Reading a conversation you are not in ---------------------------------

/**
 * `getChat`, `getChatDetails`, `fetchChatMedia`, `archiveChat` and `deleteChat`
 * all looked a chat up by the id in the URL and returned it, so any signed-in
 * account could read anybody's private messages given an id - and the
 * authorisation audit passed them, because it counted `req.params.chatId` as
 * evidence the query was scoped to the caller. A resource id names a row; it
 * does not say who is asking.
 */
const aThirdPartyChat = async () => {
  const alice = await makeOwnerWithPet(`scope-a-${Date.now()}`);
  const bob = await makeOwnerWithPet(`scope-b-${Date.now()}`);
  await makeOwnerWithPet("scope-nosy");

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set("Authorization", `Bearer ${harness.issueToken(alice.user.firebaseUid)}`)
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  return chat.body._id;
};

test("an outsider cannot read somebody else's conversation", async () => {
  const chatId = await aThirdPartyChat();

  await request(app)
    .get(`/api/chats/${chatId}`)
    .set(...auth("scope-nosy"))
    .expect(404);
});

test("an outsider cannot read its details or its media", async () => {
  const chatId = await aThirdPartyChat();

  await request(app)
    .get(`/api/chats/${chatId}/details`)
    .set(...auth("scope-nosy"))
    .expect(404);

  await request(app)
    .get(`/api/chats/${chatId}/media`)
    .set(...auth("scope-nosy"))
    .expect(404);
});

test("an outsider cannot archive or delete it", async () => {
  const chatId = await aThirdPartyChat();

  await request(app)
    .post(`/api/chats/${chatId}/archive`)
    .set(...auth("scope-nosy"))
    .expect(404);

  await request(app)
    .delete(`/api/chats/${chatId}`)
    .set(...auth("scope-nosy"))
    .expect(404);
});

test("a participant can delete their own conversation", async () => {
  await makeOwnerWithPet("del-chat-alice");
  const bob = await makeOwnerWithPet("del-chat-bob");

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("del-chat-alice"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  // `chat.remove()` was removed from Mongoose in v7, so this threw a
  // TypeError and every delete came back a 500.
  await request(app)
    .delete(`/api/chats/${chat.body._id}`)
    .set(...auth("del-chat-alice"))
    .expect(200);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const { containsBlocked, normalise } = require("../services/contentFilter");

/**
 * The filter is the cheap half of Apple 1.2 (report and block are the other
 * two thirds). What matters is that it catches the obvious spellings, does not
 * catch words that merely contain one, and that the three write paths other
 * users read - messages, group messages, reviews - actually call it.
 */
test("catches the obvious words and their common disguises", () => {
  for (const text of [
    "you're a fucking idiot",
    "F*CK off",
    "f u c k you",
    "sh1t",
    "kys loser",
    "kill yourself",
    "what a b!tch",
  ]) {
    assert.equal(containsBlocked(text), true, text);
  }
});

test("does not catch words that only contain one", () => {
  for (const text of [
    "the assassin in the film",
    "we live near Scunthorpe",
    "she is a classy dog",
    "pass the shiitake mushrooms",
    "Bo loves the park at 5",
    "",
  ]) {
    assert.equal(containsBlocked(text), false, text);
  }
  assert.equal(containsBlocked(undefined), false);
  assert.equal(containsBlocked(null), false);
});

test("normalisation collapses leetspeak and spaced letters", () => {
  assert.equal(normalise("F.U.C.K"), "fuck");
  assert.equal(normalise("sh1t h4ppens"), "shit happens");
});

// --- The write paths --------------------------------------------------------

let app;
let User;
let Pet;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwnerWithPet = async (uid) => {
  const user = await User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });
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

test("a message with blocked language is refused with 422 and never stored", async () => {
  await makeOwnerWithPet("filter-a");
  const bob = await makeOwnerWithPet("filter-b");
  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("filter-a"))
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  const refused = await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("filter-a"))
    .send({ chatId: chat.body._id, text: "you fucking idiot" });
  assert.equal(refused.status, 422);
  assert.equal(refused.body.code, "CONTENT_BLOCKED");

  const Message = require("../models/Message");
  assert.equal(await Message.countDocuments({ chat: chat.body._id }), 0);

  // The same words that are fine stay fine.
  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("filter-a"))
    .send({ chatId: chat.body._id, text: "park at 5?" })
    .expect(201);
});

test("a group message with blocked language is refused", async () => {
  const alice = await makeOwnerWithPet("filter-g");
  const bob = await makeOwnerWithPet("filter-h");
  const GroupChat = require("../models/GroupChat");
  const group = await GroupChat.create({
    groupName: "Park crew",
    chatId: "filter-group",
    participants: [alice.user._id, bob.user._id],
    creator: alice.user._id,
  });

  const refused = await request(app)
    .post("/api/groupchats/send")
    .set(...auth("filter-g"))
    .send({ groupId: String(group._id), text: "kys" });
  assert.equal(refused.status, 422);
});

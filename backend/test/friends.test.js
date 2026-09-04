const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

/**
 * Friendships.
 *
 * Nobody has ever become friends with anybody. `updateFriendStatus` - the only
 * writer, called when a request is accepted - looked for `{ sender, receiver }`
 * on a schema whose paths are `user1`/`user2`, found nothing, logged "Friend
 * relationship not found." and returned; `strictQuery` is off, so it did not
 * even error. The request went to "accepted", the acceptance notification went
 * out, and the friends list stayed empty.
 *
 * The app's "Add friend" button posted `{ senderId, recipientId }` to
 * `POST /api/friends`, whose keys the schema drops, so it failed on the three
 * required fields - and that endpoint was the wrong door anyway: it took both
 * user ids from the body, so a client could declare any two accounts friends.
 *
 * There was no way to unfriend at all: the swipe action was a `console.log`.
 */

let app;
let User;
let Pet;
let Friend;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Friend = require("../models/Friend");
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
  });

const givePet = async (owner, name) => {
  const pet = await Pet.create({
    name,
    breed: "Beagle",
    age: 3,
    weight: 20,
    owner: owner._id,
    creator: owner._id,
  });
  await User.updateOne({ _id: owner._id }, { $push: { pets: pet._id } });
  return pet;
};

/** Sends a request and accepts it, which is the only way to become friends. */
const befriend = async (senderUid, receiverUid, receiver) => {
  const created = await request(app)
    .post("/api/friendrequests")
    .set(...auth(senderUid))
    .send({ receiver: String(receiver._id) })
    .expect(201);

  await request(app)
    .put(`/api/friendrequests/${created.body._id}/accept`)
    .set(...auth(receiverUid))
    .expect(200);

  return created.body._id;
};

test("accepting a request actually makes two people friends", async () => {
  const alice = await signUp("fr-a");
  const bob = await signUp("fr-b");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");

  await befriend("fr-a", "fr-b", bob);

  const stored = await Friend.findOne({}).lean();
  assert.ok(stored, "accepting a request wrote no friendship at all");
  assert.equal(stored.status, true);

  // Stored with the pair sorted, so A-B and B-A cannot become two rows for
  // the same relationship.
  assert.deepEqual(
    [String(stored.user1), String(stored.user2)],
    [String(alice._id), String(bob._id)].sort()
  );
});

test("both people see the friendship in their list", async () => {
  const alice = await signUp("both-a");
  const bob = await signUp("both-b");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");

  await befriend("both-a", "both-b", bob);

  for (const uid of ["both-a", "both-b"]) {
    const res = await request(app)
      .get("/api/friends")
      .set(...auth(uid))
      .expect(200);
    assert.equal(res.body.length, 1, `${uid} could not see the friendship`);
  }
});

test("a stranger's friendships are not in your list", async () => {
  const alice = await signUp("priv-a");
  const bob = await signUp("priv-b");
  await signUp("priv-nosy");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");

  await befriend("priv-a", "priv-b", bob);

  const res = await request(app)
    .get("/api/friends")
    .set(...auth("priv-nosy"))
    .expect(200);

  assert.deepEqual(res.body, []);
});

test("a friendship cannot be read by somebody who is not in it", async () => {
  const alice = await signUp("read-a");
  const bob = await signUp("read-b");
  await signUp("read-nosy");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");
  await befriend("read-a", "read-b", bob);

  const friendship = await Friend.findOne({}).lean();

  await request(app)
    .get(`/api/friends/${friendship._id}`)
    .set(...auth("read-nosy"))
    .expect(404);
});

test("you cannot declare two other people friends", async () => {
  await signUp("decl-a");
  const bob = await signUp("decl-b");
  const carol = await signUp("decl-c");

  await request(app)
    .post("/api/friends")
    .set(...auth("decl-a"))
    .send({ user1: String(bob._id), user2: String(carol._id), status: true })
    .expect(410);

  assert.equal(await Friend.countDocuments({}), 0);
});

test("unfriending removes the relationship, from either side", async () => {
  const alice = await signUp("un-a");
  const bob = await signUp("un-b");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");
  await befriend("un-a", "un-b", bob);

  await request(app)
    .delete(`/api/friends/${alice._id}`)
    .set(...auth("un-b"))
    .expect(200);

  assert.equal(await Friend.countDocuments({}), 0);
});

test("unfriending somebody you are not friends with is a 404", async () => {
  await signUp("nf-a");
  const bob = await signUp("nf-b");

  await request(app)
    .delete(`/api/friends/${bob._id}`)
    .set(...auth("nf-a"))
    .expect(404);
});

test("your friends' pets are what the playdate picker gets", async () => {
  const alice = await signUp("pets-a");
  const bob = await signUp("pets-b");
  const carol = await signUp("pets-c");
  await givePet(alice, "Ada");
  const bosPet = await givePet(bob, "Bo");
  await givePet(carol, "Cleo");

  await befriend("pets-a", "pets-b", bob);

  // This matched user ids against a pet id and filtered on `Status`, a field
  // that does not exist, so the pet picker was empty however many friends you
  // had.
  const res = await request(app)
    .get("/api/friends/pets")
    .set(...auth("pets-a"))
    .expect(200);

  assert.equal(res.body.length, 1);
  assert.equal(String(res.body[0]._id), String(bosPet._id));
  assert.equal(res.body[0].name, "Bo");
});

test("you cannot send yourself a friend request", async () => {
  const alice = await signUp("self-a");

  await request(app)
    .post("/api/friendrequests")
    .set(...auth("self-a"))
    .send({ receiver: String(alice._id) })
    .expect(400);
});

test("the sender comes from the token, not the body", async () => {
  const alice = await signUp("sender-a");
  const bob = await signUp("sender-b");
  const mallory = await signUp("sender-m");
  await givePet(alice, "Ada");
  await givePet(bob, "Bo");
  await givePet(mallory, "Mal");

  const res = await request(app)
    .post("/api/friendrequests")
    .set(...auth("sender-a"))
    // A body-supplied `sender` used to decide whose name went on the request.
    .send({ receiver: String(bob._id), sender: String(mallory._id) })
    .expect(201);

  assert.equal(String(res.body.sender), String(alice._id));
});

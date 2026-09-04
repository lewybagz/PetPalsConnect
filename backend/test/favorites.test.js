const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Favorite;

/**
 * Favourites.
 *
 * `createFavorite` never set `pet`, which the schema requires, so every save
 * failed validation with a 400 - the feature has never once worked. It took
 * `user` and `creator` from the request body, so a client could favourite on
 * somebody else's behalf, and it never pushed the favourite onto
 * `user.favorites`, which is the array the read endpoint walks: even a
 * successful write would have been invisible.
 *
 * `getAllFavorites` returned every favourite in the database with every user
 * document populated - one unauthenticated-in-spirit request for the whole
 * table, everybody's email included.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Favorite = require("../models/Favorite");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
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
    weight: 25,
    breed: "Corgi",
    age: 2,
    owner: user._id,
    creator: user._id,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { user, pet };
};

test("favouriting a pet is stored and linked to the user", async () => {
  const me = await makeOwnerWithPet("fav-me");
  const them = await makeOwnerWithPet("fav-them");

  const res = await request(app)
    .post("/api/favorites")
    .set(...auth("fav-me"))
    .send({ petId: String(them.pet._id) });

  assert.equal(res.status, 201, JSON.stringify(res.body));

  const stored = await Favorite.findOne({ user: me.user._id }).lean();
  assert.ok(stored, "the favourite must be findable by its owner");
  assert.equal(String(stored.pet), String(them.pet._id));

  // Without this link the read endpoint, which walks user.favorites, shows
  // nothing however many favourites exist.
  const refreshed = await User.findById(me.user._id).lean();
  assert.equal(refreshed.favorites.length, 1);
});

test("the owner comes from the token, not the body", async () => {
  const me = await makeOwnerWithPet("owner-me");
  const other = await makeOwnerWithPet("owner-other");
  const target = await makeOwnerWithPet("owner-target");

  await request(app)
    .post("/api/favorites")
    .set(...auth("owner-me"))
    .send({
      petId: String(target.pet._id),
      user: String(other.user._id),
      creator: String(other.user._id),
    })
    .expect(201);

  assert.equal(await Favorite.countDocuments({ user: other.user._id }), 0);
  assert.equal(await Favorite.countDocuments({ user: me.user._id }), 1);
});

test("favouriting twice does not duplicate", async () => {
  const me = await makeOwnerWithPet("dupe-me");
  const them = await makeOwnerWithPet("dupe-them");

  const body = { petId: String(them.pet._id) };
  await request(app).post("/api/favorites").set(...auth("dupe-me")).send(body).expect(201);
  await request(app).post("/api/favorites").set(...auth("dupe-me")).send(body).expect(201);

  assert.equal(await Favorite.countDocuments({ user: me.user._id }), 1);
  const refreshed = await User.findById(me.user._id).lean();
  assert.equal(refreshed.favorites.length, 1);
});

test("an unknown pet is refused", async () => {
  const mongoose = require("mongoose");
  await makeOwnerWithPet("ghost-me");

  const res = await request(app)
    .post("/api/favorites")
    .set(...auth("ghost-me"))
    .send({ petId: String(new mongoose.Types.ObjectId()) });

  assert.equal(res.status, 404);
});

test("the list is only your own favourites", async () => {
  await makeOwnerWithPet("list-me");
  const them = await makeOwnerWithPet("list-them");
  const third = await makeOwnerWithPet("list-third");

  await request(app)
    .post("/api/favorites")
    .set(...auth("list-me"))
    .send({ petId: String(them.pet._id) })
    .expect(201);

  await request(app)
    .post("/api/favorites")
    .set(...auth("list-them"))
    .send({ petId: String(third.pet._id) })
    .expect(201);

  const res = await request(app).get("/api/favorites").set(...auth("list-me")).expect(200);

  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].pet.name, "list-them-pet");
});

test("unfavouriting removes it from both places", async () => {
  const me = await makeOwnerWithPet("un-me");
  const them = await makeOwnerWithPet("un-them");

  await request(app)
    .post("/api/favorites")
    .set(...auth("un-me"))
    .send({ petId: String(them.pet._id) })
    .expect(201);

  await request(app)
    .delete(`/api/favorites/pet/${them.pet._id}`)
    .set(...auth("un-me"))
    .expect(200);

  assert.equal(await Favorite.countDocuments({ user: me.user._id }), 0);
  const refreshed = await User.findById(me.user._id).lean();
  assert.equal(refreshed.favorites.length, 0);
});

test("unfavouriting something that was never favourited is fine", async () => {
  await makeOwnerWithPet("noop-me");
  const them = await makeOwnerWithPet("noop-them");

  const res = await request(app)
    .delete(`/api/favorites/pet/${them.pet._id}`)
    .set(...auth("noop-me"));

  assert.equal(res.status, 200);
  assert.equal(res.body.removed, false);
});

test("you cannot read another user's favourites", async () => {
  await makeOwnerWithPet("peek-me");
  const them = await makeOwnerWithPet("peek-them");

  const res = await request(app)
    .get(`/api/users/favorites/${them.user._id}`)
    .set(...auth("peek-me"));

  assert.equal(res.status, 403);
});

test("you can read your own through the user route", async () => {
  const me = await makeOwnerWithPet("self-me");
  const them = await makeOwnerWithPet("self-them");

  await request(app)
    .post("/api/favorites")
    .set(...auth("self-me"))
    .send({ petId: String(them.pet._id) })
    .expect(201);

  const res = await request(app)
    .get(`/api/users/favorites/${me.user._id}`)
    .set(...auth("self-me"))
    .expect(200);

  assert.equal(res.body.length, 1);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

/**
 * Notification preferences.
 *
 * Nothing here worked, on either side. `getUserPreferences` did
 * `UserPreferences.findOne({ user: req })` - the whole Express request object
 * where a user id goes - so it 404'd on every call; `getUserPreferencesById`
 * did `findById` on a *user* id, looking for a preferences document whose
 * `_id` was somebody's account id, which also never matched; and create and
 * update wrote `notificationSettings`/`searchSettings`, neither of which is a
 * path on that schema, so strict mode dropped them and a "saved" preference
 * was a document of defaults.
 *
 * `slug` was `unique: true` and not sparse, so the second account to get a row
 * would have collided with the first on null anyway.
 *
 * And nothing read them. `notify` sent every push regardless, so the screen -
 * which kept its two toggles in component state and never called the API at
 * all - was a set of switches wired to nothing.
 */

let app;
let User;
let Pet;
let UserPreferences;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  UserPreferences = require("../models/UserPreferences");
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

const givePet = (owner, name) =>
  Pet.create({
    name,
    breed: "Beagle",
    age: 3,
    weight: 20,
    owner: owner._id,
    creator: owner._id,
  });

// --- Reading and writing ----------------------------------------------------

test("the first read creates the row rather than 404ing", async () => {
  await signUp("pref-first");

  const res = await request(app)
    .get("/api/userpreferences/me")
    .set(...auth("pref-first"))
    .expect(200);

  // A settings screen that cannot open until something has been saved has
  // nothing to save from.
  assert.equal(res.body.notificationPreferences.pushNotificationsEnabled, true);
  assert.equal(await UserPreferences.countDocuments({}), 1);
});

test("two accounts can each have preferences", async () => {
  await signUp("pref-a");
  await signUp("pref-b");

  await request(app).get("/api/userpreferences/me").set(...auth("pref-a")).expect(200);
  // `slug` was unique and not sparse, so the second row collided on null.
  await request(app).get("/api/userpreferences/me").set(...auth("pref-b")).expect(200);

  assert.equal(await UserPreferences.countDocuments({}), 2);
});

test("a change is stored under the key the schema has", async () => {
  await signUp("pref-save");

  const res = await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("pref-save"))
    .send({ notificationPreferences: { messages: false } })
    .expect(200);

  assert.equal(res.body.notificationPreferences.messages, false);

  const stored = await UserPreferences.findOne({}).lean();
  assert.equal(stored.notificationPreferences.messages, false);
});

test("changing one preference leaves the rest alone", async () => {
  await signUp("pref-merge");

  await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("pref-merge"))
    .send({ notificationPreferences: { messages: false } })
    .expect(200);

  const res = await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("pref-merge"))
    .send({ notificationPreferences: { matches: false } })
    .expect(200);

  // A replace would reset every other switch each time somebody flipped one.
  assert.equal(res.body.notificationPreferences.messages, false);
  assert.equal(res.body.notificationPreferences.matches, false);
  assert.equal(res.body.notificationPreferences.playdateReminders, true);
});

test("a key the schema does not have is refused, not dropped", async () => {
  await signUp("pref-bogus");

  // Strict mode drops unknown keys without complaining, which is exactly how
  // this feature failed: the save "succeeded" and changed nothing.
  await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("pref-bogus"))
    .send({ notificationPreferences: { notificationSettings: false } })
    .expect(400);
});

test("mute-all turns everything off", async () => {
  const me = await signUp("pref-mute");

  const res = await request(app)
    .patch(`/api/userpreferences/${me._id}/mute-all`)
    .set(...auth("pref-mute"))
    .expect(200);

  for (const value of Object.values(res.body.notificationPreferences)) {
    assert.equal(value, false);
  }
});

test("somebody else's preferences are not readable or writable", async () => {
  await signUp("pref-me");
  const them = await signUp("pref-them");

  await request(app)
    .get(`/api/userpreferences/${them._id}`)
    .set(...auth("pref-me"))
    .expect(403);

  await request(app)
    .patch(`/api/userpreferences/${them._id}`)
    .set(...auth("pref-me"))
    .send({ notificationPreferences: { messages: false } })
    .expect(403);
});

// --- What they actually do --------------------------------------------------

const matchThem = async (aUid, bUid) => {
  const a = await User.findOne({ username: aUid });
  const b = await User.findOne({ username: bUid });
  const aPet = await givePet(a, "Ada");
  const bPet = await givePet(b, "Bo");

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth(bUid))
    .send({ fromPetId: String(bPet._id), toPetId: String(aPet._id), decision: "like" })
    .expect(200);

  harness.firebaseStub.sent.length = 0;

  await request(app)
    .post("/api/petmatches/decide")
    .set(...auth(aUid))
    .send({ fromPetId: String(aPet._id), toPetId: String(bPet._id), decision: "like" })
    .expect(200);
};

test("turning matches off stops that push and nothing else", async () => {
  await signUp("off-a");
  await signUp("off-b");

  await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("off-a"))
    .send({ notificationPreferences: { matches: false } })
    .expect(200);

  await matchThem("off-a", "off-b");

  const tokens = harness.firebaseStub.sent.map((message) => message.token);
  assert.deepEqual(tokens, ["fcm-off-b"], "the muted side was still pushed");
});

test("the master switch stops every push", async () => {
  await signUp("all-off-a");
  await signUp("all-off-b");

  await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("all-off-a"))
    .send({ notificationPreferences: { pushNotificationsEnabled: false } })
    .expect(200);

  await matchThem("all-off-a", "all-off-b");

  assert.deepEqual(
    harness.firebaseStub.sent.map((message) => message.token),
    ["fcm-all-off-b"]
  );
});

test("a muted push still writes the row, so the list and badge work", async () => {
  const Notification = require("../models/Notification");
  await signUp("quiet-a");
  await signUp("quiet-b");

  await request(app)
    .patch("/api/userpreferences/me")
    .set(...auth("quiet-a"))
    .send({ notificationPreferences: { pushNotificationsEnabled: false } })
    .expect(200);

  await matchThem("quiet-a", "quiet-b");

  // Muting is not blocking: it silences the phone, not the record.
  assert.equal(await Notification.countDocuments({ type: "petMatch" }), 2);
});

test("no preferences row means the defaults, which are yes", async () => {
  await signUp("default-a");
  await signUp("default-b");

  await matchThem("default-a", "default-b");

  assert.equal(harness.firebaseStub.sent.length, 2);
  assert.equal(await UserPreferences.countDocuments({}), 0);
});

test("the categories are offered to the screen rather than hard-coded in it", async () => {
  await signUp("cat-me");

  const res = await request(app)
    .get("/api/userpreferences/categories")
    .set(...auth("cat-me"))
    .expect(200);

  const keys = res.body.categories.map((category) => category.key);
  assert.ok(keys.includes("messages"));
  assert.ok(keys.includes("matches"));

  // Every category has to name a real preference, or a switch on the screen
  // governs nothing.
  const defaults = new UserPreferences({ user: (await signUp("cat-shape"))._id });
  for (const key of keys) {
    assert.ok(
      key in defaults.notificationPreferences,
      `category "${key}" is not a preference`
    );
  }
});

// --- Support tickets --------------------------------------------------------

/**
 * A ticket carries somebody's name, their email and whatever they wrote. Every
 * read was by id and unscoped, and so were the update and the delete: any
 * signed-in account could read, rewrite or destroy anybody's.
 *
 * Creating one took the name and email from the body and then *sent an email
 * to that address* quoting the body text back - a mail relay with
 * attacker-controlled recipient and content. And at 1,000 tickets the create
 * path silently deleted the oldest 500, everybody's.
 */

test("a ticket is filed under the caller's own account", async () => {
  const SupportMessage = require("../models/SupportMessage");
  await signUp("sup-me");

  await request(app)
    .post("/api/supportmessages")
    .set(...auth("sup-me"))
    // Both used to be taken at face value.
    .send({ message: "The map is empty", name: "Somebody Else", email: "victim@example.test" })
    .expect(201);

  const stored = await SupportMessage.findOne({}).lean();
  assert.equal(stored.email, "sup-me@example.test");
  assert.equal(stored.name, "sup-me");
});

test("an empty message is refused", async () => {
  await signUp("sup-empty");

  await request(app)
    .post("/api/supportmessages")
    .set(...auth("sup-empty"))
    .send({})
    .expect(400);
});

test("you only see your own tickets", async () => {
  await signUp("sup-a");
  await signUp("sup-b");

  await request(app)
    .post("/api/supportmessages")
    .set(...auth("sup-a"))
    .send({ message: "Mine" })
    .expect(201);

  const theirs = await request(app)
    .get("/api/supportmessages")
    .set(...auth("sup-b"))
    .expect(200);

  assert.deepEqual(theirs.body, []);
});

test("somebody else's ticket cannot be read or deleted", async () => {
  const SupportMessage = require("../models/SupportMessage");
  await signUp("sup-owner");
  await signUp("sup-nosy");

  await request(app)
    .post("/api/supportmessages")
    .set(...auth("sup-owner"))
    .send({ message: "Private" })
    .expect(201);

  const ticket = await SupportMessage.findOne({}).lean();

  await request(app)
    .get(`/api/supportmessages/${ticket._id}`)
    .set(...auth("sup-nosy"))
    .expect(404);

  await request(app)
    .delete(`/api/supportmessages/${ticket._id}`)
    .set(...auth("sup-nosy"))
    .expect(404);

  assert.equal(await SupportMessage.countDocuments({}), 1);
});

test("a ticket cannot be rewritten", async () => {
  const SupportMessage = require("../models/SupportMessage");
  await signUp("sup-edit");

  await request(app)
    .post("/api/supportmessages")
    .set(...auth("sup-edit"))
    .send({ message: "Original" })
    .expect(201);

  const ticket = await SupportMessage.findOne({}).lean();

  // Took `req.body` wholesale on any ticket by id, so a support conversation
  // could be rewritten by anybody, into anybody's name.
  await request(app)
    .put(`/api/supportmessages/${ticket._id}`)
    .set(...auth("sup-edit"))
    .send({ message: "Rewritten", email: "someone@else.test" })
    .expect(410);

  const after = await SupportMessage.findById(ticket._id).lean();
  assert.equal(after.message, "Original");
});

test("filing many tickets does not delete anybody's", async () => {
  const SupportMessage = require("../models/SupportMessage");
  await signUp("sup-bulk");

  for (let index = 0; index < 5; index += 1) {
    await request(app)
      .post("/api/supportmessages")
      .set(...auth("sup-bulk"))
      .send({ message: `Ticket ${index}` })
      .expect(201);
  }

  assert.equal(await SupportMessage.countDocuments({}), 5);
});

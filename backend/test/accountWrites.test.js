const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;

/**
 * Writing to an account that is not yours.
 *
 * `authenticate` proves the caller has *an* account, never that a row is
 * theirs, and `getUserById` scopes what a stranger may *read* - it projects
 * public fields and 404s across a block. Nothing scoped the writes behind it:
 * `PUT`, `PATCH` and `DELETE /api/users/:id` took the id straight from the URL
 * and saved or deleted whatever it named.
 *
 * That is the same class the audit was taught to catch for reads - "a resource
 * id is not an identity" - one verb over. The audit could not see it because
 * these handlers never build a query at all; they mutate the document the
 * middleware already fetched.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
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
    ...extra,
  });

test("you cannot delete somebody else's account", async () => {
  // The worst of them: any signed-in account could delete any other.
  await makeUser("deleter");
  const victim = await makeUser("victim");

  const res = await request(app)
    .delete(`/api/users/${victim._id}`)
    .set(...auth("deleter"));

  assert.ok(res.status === 403 || res.status === 404, `got ${res.status}`);
  assert.ok(await User.findById(victim._id), "the victim's account is gone");
});

test("you cannot edit somebody else's account", async () => {
  await makeUser("editor");
  const victim = await makeUser("edit-victim");

  const res = await request(app)
    .patch(`/api/users/${victim._id}`)
    .set(...auth("editor"))
    .send({ email: "attacker@example.test", userPhoto: null });

  assert.ok(res.status === 403 || res.status === 404, `got ${res.status}`);
  const after = await User.findById(victim._id);
  assert.equal(after.email, "edit-victim@example.test");
});

test("you cannot make yourself a subscriber", async () => {
  // Stripe is the source of truth for billing and `syncFromStripe` is the only
  // writer. A client that can set this walks straight through the paywall.
  const me = await makeUser("freeloader");

  await request(app)
    .patch(`/api/users/${me._id}`)
    .set(...auth("freeloader"))
    .send({ subscribed: true, verified: true });

  const after = await User.findById(me._id);
  assert.equal(after.subscribed, false);
  assert.equal(after.verified, false);
});

test("you cannot rewrite your own pets or friends list", async () => {
  // Both are maintained by the endpoints that own them; letting a body replace
  // them wholesale is how somebody claims a pet that is not theirs.
  const me = await makeUser("rewriter");
  const other = await makeUser("rewrite-other");

  await request(app)
    .patch(`/api/users/${me._id}`)
    .set(...auth("rewriter"))
    .send({ friendsList: [String(other._id)], pets: [] });

  const after = await User.findById(me._id);
  assert.deepEqual(after.friendsList.map(String), []);
});

test("you can still change your own username", async () => {
  // This read `req.body.Username` against a lowercase schema, so strict mode
  // dropped it and renaming yourself silently did nothing.
  const me = await makeUser("renamer");

  const res = await request(app)
    .patch(`/api/users/${me._id}`)
    .set(...auth("renamer"))
    .send({ username: "NewName" })
    .expect(200);

  assert.equal(res.body.username, "NewName");
  const after = await User.findById(me._id);
  assert.equal(after.username, "NewName");
  // Uniqueness is enforced on the lowercased copy, so it has to follow.
  assert.equal(after.usernameLower, "newname");
});

test("a username somebody else holds is refused", async () => {
  await makeUser("taken-holder", { username: "Taken" });
  const me = await makeUser("taker");

  const res = await request(app)
    .patch(`/api/users/${me._id}`)
    .set(...auth("taker"))
    .send({ username: "taken" });

  assert.equal(res.status, 409);
});

test("an invalid username is refused with a reason", async () => {
  const me = await makeUser("shortname");

  const res = await request(app)
    .patch(`/api/users/${me._id}`)
    .set(...auth("shortname"))
    .send({ username: "a" });

  assert.equal(res.status, 400);
  assert.ok(res.body.message);
});

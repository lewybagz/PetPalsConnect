const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;

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

test("signup creates a Mongo profile linked to the Firebase uid", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("new-signup"))
    .send({ username: "petlover" });

  assert.equal(res.status, 201);
  assert.equal(res.body.firebaseUid, "new-signup");
  assert.equal(res.body.username, "petlover");
  assert.equal(res.body.email, "new-signup@example.test");
});

test("signup never stores a password, even if one is sent", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("pw-attempt"))
    .send({ username: "nopw", password: "hunter2" });

  assert.equal(res.status, 201);
  assert.equal(res.body.password, undefined);

  const stored = await User.findOne({ firebaseUid: "pw-attempt" }).lean();
  assert.equal(stored.password, undefined);
});

test("signup takes identity from the token, not the request body", async () => {
  // A client trying to claim someone else's identity must not succeed.
  const res = await request(app)
    .post("/api/users")
    .set(...auth("real-user"))
    .send({
      username: "impostor",
      firebaseUid: "someone-elses-uid",
      email: "victim@example.test",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.firebaseUid, "real-user");
  assert.equal(res.body.email, "real-user@example.test");
});

test("signup is idempotent - retrying returns the existing profile", async () => {
  const header = auth("retry-user");

  const first = await request(app)
    .post("/api/users")
    .set(...header)
    .send({ username: "retry" });
  assert.equal(first.status, 201);

  const second = await request(app)
    .post("/api/users")
    .set(...header)
    .send({ username: "retry" });

  assert.equal(second.status, 200);
  assert.equal(second.body._id, first.body._id);
  assert.equal(await User.countDocuments({ firebaseUid: "retry-user" }), 1);
});

test("a duplicate username is reported as a conflict, not a 500", async () => {
  await User.create({
    firebaseUid: "first-owner",
    username: "taken",
    email: "first@example.test",
  });

  const res = await request(app)
    .post("/api/users")
    .set(...auth("second-owner"))
    .send({ username: "taken" });

  assert.equal(res.status, 409);
});

test("changing a password server-side is refused - Firebase owns credentials", async () => {
  const res = await request(app)
    .post("/api/users/settings/change-password")
    .set(...auth("any-user"))
    .send({ newPassword: "whatever" });

  assert.equal(res.status, 410);
  assert.match(res.body.message, /Firebase/);
});

test("settings updates apply to the caller's own profile", async () => {
  const user = await User.create({
    firebaseUid: "settings-user",
    username: "settings",
    email: "settings@example.test",
  });

  const res = await request(app)
    .post("/api/users/settings")
    .set(...auth("settings-user"))
    .send({ playdateRange: "Within 20 miles", locationSharingEnabled: false });

  assert.equal(res.status, 200);

  const updated = await User.findById(user._id).lean();
  assert.equal(updated.playdateRange, "Within 20 miles");
  assert.equal(updated.locationSharingEnabled, false);
});

test("notification preferences round-trip", async () => {
  await User.create({
    firebaseUid: "prefs-user",
    username: "prefs",
    email: "prefs@example.test",
  });

  const res = await request(app)
    .post("/api/users/notification-preferences")
    .set(...auth("prefs-user"))
    .send({ playdateReminders: true, appUpdates: false });

  assert.equal(res.status, 200);
  assert.equal(res.body.user.notificationPreferences.playdateReminders, true);
});

test('"me" is not treated as a user id by the /:id route', async () => {
  await User.create({
    firebaseUid: "ordering-user",
    username: "ordering",
    email: "ordering@example.test",
  });

  const res = await request(app)
    .get("/api/users/me")
    .set(...auth("ordering-user"));

  // A cast error (500) here would mean "/:id" matched "me" first.
  assert.equal(res.status, 200);
  assert.equal(res.body.username, "ordering");
});

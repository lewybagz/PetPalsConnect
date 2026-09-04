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
    .send({ playdateRange: 20, locationSharingEnabled: false });

  assert.equal(res.status, 200);

  const updated = await User.findById(user._id).lean();
  assert.equal(updated.playdateRange, 20);
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

// --- Username rules -------------------------------------------------------

test("usernames are unique case-insensitively", async () => {
  await request(app)
    .post("/api/users")
    .set(...auth("first-casing"))
    .send({ username: "PetLover" })
    .expect(201);

  const res = await request(app)
    .post("/api/users")
    .set(...auth("second-casing"))
    .send({ username: "petlover" });

  assert.equal(res.status, 409);
  assert.equal(res.body.field, "username");
});

test("the display casing a user chose is preserved", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("casing-kept"))
    .send({ username: "PetLover" });

  assert.equal(res.body.username, "PetLover");
  assert.equal(res.body.usernameLower, "petlover");
});

test("reserved usernames are refused", async () => {
  for (const reserved of ["admin", "support", "settings", "PetPals"]) {
    const res = await request(app)
      .post("/api/users")
      .set(...auth(`reserved-${reserved}`))
      .send({ username: reserved });

    assert.equal(res.status, 400, `expected ${reserved} to be refused`);
    assert.equal(res.body.field, "username");
  }
});

test("malformed usernames are refused with a readable reason", async () => {
  const cases = [
    ["ab", /at least 3/],
    ["a".repeat(21), /at most 20/],
    ["has spaces", /letters, numbers and underscores/],
    ["emoji", null],
  ];

  for (const [candidate, pattern] of cases) {
    if (!pattern) continue;
    const res = await request(app)
      .post("/api/users")
      .set(...auth(`bad-${candidate.length}-${candidate[0]}`))
      .send({ username: candidate });

    assert.equal(res.status, 400);
    assert.match(res.body.message, pattern);
  }
});

test("signup with no username is refused rather than saving a broken profile", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("no-username"))
    .send({});

  assert.equal(res.status, 400);
  assert.equal(await User.countDocuments({ firebaseUid: "no-username" }), 0);
});

// --- Availability ---------------------------------------------------------

test("an unused, well-formed username reads as available", async () => {
  const res = await request(app)
    .get("/api/users/username-available?username=freshname")
    .set(...auth("checker"));

  assert.equal(res.status, 200);
  assert.equal(res.body.available, true);
});

test("a taken username reads as unavailable, ignoring case", async () => {
  await User.create({
    firebaseUid: "holder",
    username: "TakenName",
    email: "holder@example.test",
  });

  const res = await request(app)
    .get("/api/users/username-available?username=takenname")
    .set(...auth("checker2"));

  assert.equal(res.body.available, false);
  assert.match(res.body.reason, /already taken/);
});

test("availability explains why an invalid username is unavailable", async () => {
  const res = await request(app)
    .get("/api/users/username-available?username=me")
    .set(...auth("checker3"));

  assert.equal(res.body.available, false);
  assert.ok(res.body.reason, "expected a reason the user can act on");
});

test("availability agrees with what signup will accept", async () => {
  // These two must never disagree, or a name reads free and then fails.
  const candidates = ["goodname", "me", "admin", "ab", "has spaces", "ok_name_1"];

  for (const candidate of candidates) {
    const check = await request(app)
      .get(`/api/users/username-available?username=${encodeURIComponent(candidate)}`)
      .set(...auth(`agree-${candidate.length}`));

    const created = await request(app)
      .post("/api/users")
      .set(...auth(`create-${candidate}`))
      .send({ username: candidate });

    const signupAccepted = created.status === 201;
    assert.equal(
      check.body.available,
      signupAccepted,
      `availability and signup disagreed on "${candidate}"`
    );
  }
});

// --- Account deletion (App Store guideline 5.1.1(v)) ----------------------

test("a user can delete their own account", async () => {
  await User.create({
    firebaseUid: "deleting-user",
    username: "goodbye",
    email: "goodbye@example.test",
  });

  const res = await request(app)
    .delete("/api/users/me")
    .set(...auth("deleting-user"));

  assert.equal(res.status, 200);
  assert.equal(await User.countDocuments({ firebaseUid: "deleting-user" }), 0);
});

test("deleting with no profile reports 404 rather than failing", async () => {
  const res = await request(app)
    .delete("/api/users/me")
    .set(...auth("nothing-to-delete"));

  assert.equal(res.status, 404);
});

test("deletion frees the username for someone else", async () => {
  await request(app)
    .post("/api/users")
    .set(...auth("original-owner"))
    .send({ username: "recycled" })
    .expect(201);

  await request(app)
    .delete("/api/users/me")
    .set(...auth("original-owner"))
    .expect(200);

  const res = await request(app)
    .post("/api/users")
    .set(...auth("new-owner"))
    .send({ username: "recycled" });

  assert.equal(res.status, 201);
});

test("a range from an older client is converted, not rejected", async () => {
  const user = await User.create({
    firebaseUid: "legacy-range",
    username: "legacyrange",
    email: "legacyrange@example.test",
  });

  // `playdateRange` was an enum of strings, and the settings slider sent a
  // number - so every save failed validation and the preference never stuck.
  // Now it is miles, and a cached string still resolves.
  await request(app)
    .post("/api/users/settings")
    .set(...auth("legacy-range"))
    .send({ playdateRange: "Within 20 miles" })
    .expect(200);

  const updated = await User.findById(user._id).lean();
  assert.equal(updated.playdateRange, 20);
});

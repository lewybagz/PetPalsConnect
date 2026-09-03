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

test("health check is reachable without a token", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.database, "connected");
});

test("a protected route rejects a request with no Authorization header", async () => {
  const res = await request(app).get("/api/pets");
  assert.equal(res.status, 401);
  assert.match(res.body.message, /Authorization header/);
});

test("a protected route rejects a malformed Authorization header", async () => {
  const res = await request(app).get("/api/pets").set("Authorization", "token-without-scheme");
  assert.equal(res.status, 401);
});

test("a protected route rejects an unknown token", async () => {
  const res = await request(app).get("/api/pets").set("Authorization", "Bearer nope");
  assert.equal(res.status, 401);
  assert.match(res.body.message, /Invalid or expired/);
});

test("a valid token is accepted even before a Mongo profile exists", async () => {
  const token = harness.issueToken("brand-new-user");
  const res = await request(app).get("/api/pets").set("Authorization", `Bearer ${token}`);

  // Authentication succeeded; the request got past the middleware.
  assert.notEqual(res.status, 401);
});

test("authenticate resolves the Firebase uid to the Mongo user", async () => {
  await User.create({
    firebaseUid: "known-user",
    username: "known",
    email: "known@example.test",
  });

  const token = harness.issueToken("known-user");
  const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.username, "known");
  assert.equal(res.body.firebaseUid, "known-user");
});

test("routes needing a profile return 404, not a crash, when none exists", async () => {
  const token = harness.issueToken("no-profile-yet");
  const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 404);
  assert.equal(res.body.code, "PROFILE_NOT_FOUND");
});

test("unknown routes return a JSON 404", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
  assert.match(res.body.message, /Not found/);
});

test("security headers are applied", async () => {
  const res = await request(app).get("/health");
  assert.ok(res.headers["x-content-type-options"], "expected helmet headers");
});

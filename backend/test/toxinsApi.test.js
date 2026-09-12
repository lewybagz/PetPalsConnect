const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;

/**
 * `GET /api/petcare/toxins` - the poison table over the wire.
 *
 * The table itself is tested in `toxins.test.js`; this is about the endpoint
 * contract the screen depends on. The one that matters most is that the
 * emergency numbers travel with the table, because every answer the lookup
 * gives has to end at a phone number and the screen must not be able to render
 * a result with no way to ring anybody.
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

const makeUser = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test` });

test("the table and the numbers to ring arrive together", async () => {
  await makeUser("owner");

  const res = await request(app)
    .get("/api/petcare/toxins")
    .set(...auth("owner"))
    .expect(200);

  assert.ok(Array.isArray(res.body.toxins) && res.body.toxins.length >= 30);
  assert.deepEqual(res.body.severities, ["emergency", "call", "avoid"]);

  // The helpline is the whole point of the feature.
  assert.ok(res.body.contacts.length >= 1);
  for (const contact of res.body.contacts) {
    assert.ok(contact.name?.trim());
    assert.match(contact.phone ?? "", /\d{3}-\d{3}-\d{4}/);
  }
});

test("entries arrive with their sources, so the screen can show them", async () => {
  await makeUser("owner");

  const res = await request(app)
    .get("/api/petcare/toxins")
    .set(...auth("owner"))
    .expect(200);

  const grapes = res.body.toxins.find((t) => t.slug === "grapes-raisins");
  assert.ok(grapes, "the second most-called-about toxin is in the payload");
  assert.equal(grapes.severity, "emergency");
  assert.ok(grapes.sources.length >= 1);
  assert.match(grapes.sources[0].url, /^https:\/\//);
});

test("what cannot wait is first in the payload", async () => {
  await makeUser("owner");

  const res = await request(app)
    .get("/api/petcare/toxins")
    .set(...auth("owner"))
    .expect(200);

  assert.equal(res.body.toxins[0].severity, "emergency");
});

test("it needs an account, like every other route", async () => {
  await request(app).get("/api/petcare/toxins").expect(401);
});

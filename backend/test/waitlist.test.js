const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Waitlist;

/**
 * The launch fence's server half: a profile learns its region from its ZIP,
 * and the waitlist records where somebody said they were - from the profile,
 * never from the body.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Waitlist = require("../models/Waitlist");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

test("a profile created with an Arizona ZIP is in the launch region", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("phx"))
    .send({ username: "phx_owner", zip: "85004" })
    .expect(201);

  assert.equal(res.body.zip, "85004");
  assert.equal(res.body.region, "AZ");
});

test("a profile from elsewhere is 'other', and one without a ZIP has no region", async () => {
  const la = await request(app)
    .post("/api/users")
    .set(...auth("la"))
    .send({ username: "la_owner", zip: "90210" })
    .expect(201);
  assert.equal(la.body.region, "other");

  // An older build that sends no ZIP: let in, like every row that predates a field.
  const old = await request(app)
    .post("/api/users")
    .set(...auth("old"))
    .send({ username: "old_build" })
    .expect(201);
  assert.equal(old.body.region, undefined);
});

test("a ZIP that is not one is refused, naming the field", async () => {
  const res = await request(app)
    .post("/api/users")
    .set(...auth("typo"))
    .send({ username: "typo", zip: "8500" })
    .expect(400);

  assert.equal(res.body.field, "zip");
});

test("joining the waitlist is idempotent and takes the region from the profile", async () => {
  await User.create({ firebaseUid: "la", username: "la_owner", email: "la@example.test", zip: "90210" });

  const first = await request(app)
    .post("/api/waitlist")
    .set(...auth("la"))
    // A body cannot move somebody: where they are is what they told the profile.
    .send({ zip: "85004", region: "AZ" })
    .expect(201);
  assert.equal(first.body.joined, true);

  await request(app).post("/api/waitlist").set(...auth("la")).expect(201);

  const rows = await Waitlist.find({}).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].zip, "90210");
  assert.equal(rows[0].region, "other");

  const me = await request(app).get("/api/waitlist/me").set(...auth("la")).expect(200);
  assert.equal(me.body.joined, true);
});

test("the waitlist is per account", async () => {
  await User.create({ firebaseUid: "a", username: "a", email: "a@example.test", zip: "90210" });
  await User.create({ firebaseUid: "b", username: "b", email: "b@example.test", zip: "10001" });

  await request(app).post("/api/waitlist").set(...auth("a")).expect(201);

  const b = await request(app).get("/api/waitlist/me").set(...auth("b")).expect(200);
  assert.equal(b.body.joined, false);
});

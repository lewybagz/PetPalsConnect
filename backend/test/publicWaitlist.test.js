const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let PublicWaitlist;
let limits;

/**
 * The website's waitlist: the API's only unauthenticated write a person can
 * reach. Everything here is about what it accepts from a stranger.
 */
test.before(async () => {
  app = await harness.start();
  PublicWaitlist = require("../models/PublicWaitlist");
  limits = require("../middleware/rateLimits");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const join = (body) => request(app).post("/api/waitlist/public").send(body);

test("an unauthenticated POST is accepted, and there is no token anywhere", async () => {
  const res = await join({ email: "Dana@Example.com", zip: "85004" }).expect(201);
  assert.deepEqual(res.body, { joined: true });

  const row = await PublicWaitlist.findOne({ email: "dana@example.com" }).lean();
  assert.ok(row, "the row was written");
  // Lowercased by the schema, so two casings of one address are one person.
  assert.equal(row.email, "dana@example.com");
  assert.equal(row.zip, "85004");
});

test("region is derived from the ZIP and ignored if sent in the body", async () => {
  await join({ email: "phx@example.com", zip: "85004", region: "CA" }).expect(201);
  await join({ email: "la@example.com", zip: "90210", region: "AZ" }).expect(201);

  const phx = await PublicWaitlist.findOne({ email: "phx@example.com" }).lean();
  const la = await PublicWaitlist.findOne({ email: "la@example.com" }).lean();

  // The list's only job is to say where demand is. A body-supplied region
  // would make every row worthless.
  assert.equal(phx.region, "AZ");
  assert.equal(la.region, "other");
});

test("submitting the same address twice is idempotent, not an error", async () => {
  await join({ email: "twice@example.com", zip: "85701" }).expect(201);
  const second = await join({ email: "TWICE@example.com", zip: "86001" }).expect(201);

  assert.deepEqual(second.body, { joined: true });
  assert.equal(await PublicWaitlist.countDocuments({}), 1);

  // The later ZIP wins: somebody correcting a typo is the likeliest reason to
  // submit twice, and the newer answer is the one they meant.
  const row = await PublicWaitlist.findOne({}).lean();
  assert.equal(row.zip, "86001");
});

test("a malformed email is a 400 and writes nothing", async () => {
  for (const email of ["", "not-an-email", "a@b", "no at sign.com", null]) {
    const res = await join({ email, zip: "85004" }).expect(400);
    assert.equal(res.body.code, "INVALID_EMAIL");
  }
  assert.equal(await PublicWaitlist.countDocuments({}), 0);
});

test("a malformed ZIP is a 400 and writes nothing", async () => {
  for (const zip of ["", "8500", "850011", "ABCDE", null]) {
    const res = await join({ email: "zip@example.com", zip }).expect(400);
    assert.equal(res.body.code, "INVALID_ZIP");
  }
  assert.equal(await PublicWaitlist.countDocuments({}), 0);
});

test("there is no read path - nothing can enumerate or probe the list", async () => {
  await join({ email: "private@example.com", zip: "85004" }).expect(201);

  // An endpoint answering "is this address waiting?" would be an existence
  // oracle for anybody with a wordlist, so none exists. Both of these fall
  // through to the authenticated mount and are refused for want of a token.
  await request(app).get("/api/waitlist/public").expect(401);
  await request(app).get("/api/waitlist/public/private@example.com").expect(401);
});

test("the rate limit bites, per address", async () => {
  limits.setEnabled(true);
  try {
    // The limiter allows 10/hour. A person fills this in once.
    for (let i = 0; i < 10; i += 1) {
      await join({ email: `flood${i}@example.com`, zip: "85004" }).expect(201);
    }
    const blocked = await join({ email: "flood10@example.com", zip: "85004" }).expect(429);
    assert.equal(blocked.body.code, "RATE_LIMITED");
  } finally {
    limits.setEnabled(false);
  }
});

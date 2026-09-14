const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let AnalyticsEvent;
let User;

/**
 * Product analytics: the funnel this app had no way of seeing.
 *
 * Three properties are worth a test here and the rest is counting. Identity
 * comes from the token, never the body, because an event written as somebody
 * else would poison the one number the roadmap is argued from. An unknown name
 * is dropped rather than rejected, because the app updates through a store and
 * the server does not, so a client one version ahead must not lose the events
 * either side of the one it invented. And the funnel read is a cross-account
 * query that is safe only while its route keeps `requireModerator`.
 */
test.before(async () => {
  app = await harness.start();
  AnalyticsEvent = require("../models/AnalyticsEvent");
  User = require("../models/User");
});

test.after(async () => {
  await harness.stop();
  delete process.env.MODERATOR_EMAILS;
});

test.beforeEach(async () => {
  await harness.clear();
  delete process.env.MODERATOR_EMAILS;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

/**
 * A moderator is a profile whose email is in the env allowlist - there is no
 * role on `User` to grant, deliberately (`MODERATOR_EMAILS` has nothing to
 * escalate into). `requireModerator` reads `req.user.email`, so the token alone
 * is not enough: the row has to exist.
 */
const asModerator = async (uid = "mod") => {
  const email = `${uid}@example.test`;
  process.env.MODERATOR_EMAILS = email;
  await User.create({
    firebaseUid: uid,
    username: uid,
    usernameLower: uid,
    email,
  });
  return ["Authorization", `Bearer ${harness.issueToken(uid, { email })}`];
};

test("an event is recorded against the caller's uid, before any profile exists", async () => {
  // No POST /api/users first: this is the zombie-account window, and recording
  // it is the entire reason the model keys on the Firebase uid.
  const res = await request(app)
    .post("/api/analytics/events")
    .set(...auth("newcomer"))
    .send({ events: [{ name: "account_created" }], platform: "ios" })
    .expect(202);

  assert.equal(res.body.recorded, 1);

  const rows = await AnalyticsEvent.find({}).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].firebaseUid, "newcomer");
  assert.equal(rows[0].userId, null);
  assert.equal(rows[0].platform, "ios");
});

test("a profile's events carry the Mongo id as well", async () => {
  await request(app)
    .post("/api/users")
    .set(...auth("owner"))
    .send({ acceptedTerms: true, username: "owner_one", zip: "85004" })
    .expect(201);

  await request(app)
    .post("/api/analytics/events")
    .set(...auth("owner"))
    .send({ events: [{ name: "first_swipe" }] })
    .expect(202);

  const row = await AnalyticsEvent.findOne({ name: "first_swipe" }).lean();
  const user = await User.findOne({ firebaseUid: "owner" }).lean();
  assert.equal(row.firebaseUid, "owner");
  assert.equal(String(row.userId), String(user._id));
});

test("a client cannot write events as somebody else", async () => {
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("honest"))
    .send({
      events: [{ name: "first_match" }],
      // All three ignored: identity is the token's.
      firebaseUid: "victim",
      userId: "507f1f77bcf86cd799439011",
    })
    .expect(202);

  const row = await AnalyticsEvent.findOne({}).lean();
  assert.equal(row.firebaseUid, "honest");
});

test("an unknown event name is dropped, and the known ones around it still land", async () => {
  const res = await request(app)
    .post("/api/analytics/events")
    .set(...auth("ahead"))
    .send({
      events: [
        { name: "app_opened" },
        // A name from a client build the server has not learnt yet.
        { name: "invented_by_a_newer_build" },
        { name: "signup_started" },
      ],
    })
    .expect(202);

  assert.equal(res.body.received, 3);
  assert.equal(res.body.recorded, 2);

  const names = (await AnalyticsEvent.find({}).lean()).map((r) => r.name).sort();
  assert.deepEqual(names, ["app_opened", "signup_started"]);
});

test("props are kept small and scalar; a nested object is dropped", async () => {
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("propper"))
    .send({
      events: [
        {
          name: "pet_created",
          props: {
            species: "dog",
            matchable: true,
            count: 2,
            // `props` is Mixed, so Mongoose casts nothing - this is a trust
            // boundary and the controller is what makes it one.
            nested: { deeply: { wrong: true } },
            long: "x".repeat(500),
          },
        },
      ],
    })
    .expect(202);

  const { props } = await AnalyticsEvent.findOne({ name: "pet_created" }).lean();
  assert.equal(props.species, "dog");
  assert.equal(props.matchable, true);
  assert.equal(props.count, 2);
  assert.equal(props.nested, undefined);
  assert.equal(props.long.length, 200);
});

test("a device clock far from now falls back to the server's time", async () => {
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("timetraveller"))
    .send({
      events: [
        { name: "app_opened", at: "1999-01-01T00:00:00.000Z" },
        { name: "signup_started", at: new Date().toISOString() },
      ],
    })
    .expect(202);

  const old = await AnalyticsEvent.findOne({ name: "app_opened" }).lean();
  assert.ok(
    Date.now() - old.at.getTime() < 60_000,
    "an implausible device clock should not write events into 1999"
  );

  // A plausible one is kept, which is the point of sending `at` at all.
  const recent = await AnalyticsEvent.findOne({ name: "signup_started" }).lean();
  assert.ok(Date.now() - recent.at.getTime() < 60_000);
});

test("the funnel counts distinct accounts per step, not raw events", async () => {
  const mod = await asModerator();

  // One person opening the app three times is one person who opened the app.
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("repeat"))
    .send({
      events: [
        { name: "app_opened" },
        { name: "app_opened" },
        { name: "app_opened" },
        { name: "signup_started" },
      ],
    })
    .expect(202);

  await request(app)
    .post("/api/analytics/events")
    .set(...auth("other"))
    .send({ events: [{ name: "app_opened" }] })
    .expect(202);

  const res = await request(app)
    .get("/api/analytics/funnel")
    .set(...mod)
    .expect(200);

  const step = (order) => res.body.steps.find((s) => s.order === order);
  assert.equal(step(1).users, 2, "two accounts opened the app");
  assert.equal(step(2).users, 1, "one of them started signing up");
});

test("pet_created and pet_skipped are the same funnel step", async () => {
  const mod = await asModerator();

  await request(app)
    .post("/api/analytics/events")
    .set(...auth("adder"))
    .send({ events: [{ name: "pet_created" }] })
    .expect(202);

  await request(app)
    .post("/api/analytics/events")
    .set(...auth("skipper"))
    .send({ events: [{ name: "pet_skipped" }] })
    .expect(202);

  const res = await request(app)
    .get("/api/analytics/funnel")
    .set(...mod)
    .expect(200);

  const petStep = res.body.steps.find((s) => s.names.includes("pet_created"));
  assert.equal(
    petStep.users,
    2,
    "answering the prompt either way continues to the next step"
  );
});

test("the funnel is a moderator's, and an ordinary account is told nothing", async () => {
  const mod = await asModerator();

  // 404 rather than 403, which is `requireModerator`'s own rule: a 403 would
  // confirm the route exists and that somebody has the rights to it.
  await request(app)
    .get("/api/analytics/funnel")
    .set(...auth("nosy"))
    .expect(404);

  await request(app)
    .get("/api/analytics/funnel")
    .set(...mod)
    .expect(200);
});

test("deleting an account deletes its events, including the pre-profile ones", async () => {
  // Events written before the profile exists - the ones with no `userId`.
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("leaver"))
    .send({ events: [{ name: "account_created" }] })
    .expect(202);

  await request(app)
    .post("/api/users")
    .set(...auth("leaver"))
    .send({ acceptedTerms: true, username: "leaver_one", zip: "85004" })
    .expect(201);

  // ...and one after, which carries both ids.
  await request(app)
    .post("/api/analytics/events")
    .set(...auth("leaver"))
    .send({ events: [{ name: "onboarding_completed" }] })
    .expect(202);

  assert.equal(await AnalyticsEvent.countDocuments({}), 2);

  await request(app)
    .delete("/api/users/me")
    .set(...auth("leaver"))
    .expect(200);

  assert.equal(
    await AnalyticsEvent.countDocuments({}),
    0,
    "a cascade matching only `userId` would leave the pre-profile half behind"
  );
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Subscription;
let env;

const SECRET = "rc-webhook-secret-for-tests";

/**
 * The store is the source of truth and the RevenueCat webhook is the only way
 * it reaches this server, so nearly everything here is a webhook delivery and
 * what the database says afterwards. The route, the sync and the persistence
 * are all real code; only the caller is simulated.
 */
test.before(async () => {
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  app = await harness.start();
  User = require("../models/User");
  Subscription = require("../models/Subscription");
  env = require("../config/env");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = async (uid, username) => {
  const user = await User.create({
    firebaseUid: uid,
    username,
    email: `${uid}@example.test`,
  });
  return [auth(uid), user];
};

const DAY = 86400000;

/** A payload shaped like RevenueCat's, with the fields the sync reads. */
const event = (overrides) => ({
  api_version: "1.0",
  event: {
    id: "evt_1",
    type: "INITIAL_PURCHASE",
    app_user_id: "buyer",
    product_id: "petpals_plus_monthly",
    period_type: "NORMAL",
    store: "APP_STORE",
    environment: "SANDBOX",
    original_transaction_id: "tx_original",
    purchased_at_ms: Date.now(),
    expiration_at_ms: Date.now() + 30 * DAY,
    price: 4.99,
    currency: "USD",
    ...overrides,
  },
});

const deliver = (body, header = SECRET) =>
  request(app).post("/api/revenuecat-webhooks").set("Authorization", header).send(body);

// --- Authentication --------------------------------------------------------

test("a webhook without the configured header is refused", async () => {
  await signUp("buyer", "buyer");

  assert.equal((await deliver(event(), "wrong")).status, 401);
  assert.equal(
    (await request(app).post("/api/revenuecat-webhooks").send(event())).status,
    401
  );
  assert.equal(await Subscription.countDocuments(), 0);
});

test("with no secret configured the webhook answers 503, not 401", async () => {
  const saved = env.revenuecat.webhookSecret;
  env.revenuecat.webhookSecret = "";
  try {
    assert.equal((await deliver(event())).status, 503);
  } finally {
    env.revenuecat.webhookSecret = saved;
  }
});

test("a body with no event is a 400", async () => {
  assert.equal((await deliver({ api_version: "1.0" })).status, 400);
});

// --- Lifecycle -------------------------------------------------------------

test("an initial purchase creates the record and marks the user subscribed", async () => {
  const [, user] = await signUp("buyer", "buyer");

  const res = await deliver(event());
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.ok(stored);
  assert.equal(stored.status, "active");
  assert.equal(stored.store, "app_store");
  assert.equal(stored.productId, "petpals_plus_monthly");
  assert.equal(stored.planType, "month");
  assert.equal(stored.amount, 4.99);
  assert.equal(stored.currency, "usd");
  assert.equal(stored.originalTransactionId, "tx_original");

  assert.equal((await User.findById(user._id).lean()).subscribed, true);
});

test("a trial is trialing, and a yearly product is a yearly plan", async () => {
  const [, user] = await signUp("buyer", "buyer");

  await deliver(event({ period_type: "TRIAL", product_id: "petpals_plus_annual" })).expect(200);

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.equal(stored.status, "trialing");
  assert.equal(stored.planType, "year");
  assert.equal((await User.findById(user._id).lean()).subscribed, true);
});

test("a retried delivery lands on the same row", async () => {
  const [, user] = await signUp("buyer", "buyer");

  await deliver(event()).expect(200);
  await deliver(event()).expect(200);
  await deliver(event({ id: "evt_2", type: "RENEWAL" })).expect(200);

  assert.equal(await Subscription.countDocuments({ user: user._id }), 1);
});

test("opting out of renewal keeps the entitlement until the period ends", async () => {
  const [, user] = await signUp("buyer", "buyer");
  await deliver(event()).expect(200);

  await deliver(
    event({ id: "evt_2", type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" })
  ).expect(200);

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.equal(stored.status, "active");
  assert.equal(stored.cancelAtPeriodEnd, true);
  assert.equal((await User.findById(user._id).lean()).subscribed, true);
});

test("a refund ends the entitlement now", async () => {
  const [, user] = await signUp("buyer", "buyer");
  await deliver(event()).expect(200);

  await deliver(
    event({ id: "evt_2", type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" })
  ).expect(200);

  assert.equal((await Subscription.findOne({ user: user._id }).lean()).status, "canceled");
  assert.equal((await User.findById(user._id).lean()).subscribed, false);
});

test("expiration clears the entitlement", async () => {
  const [, user] = await signUp("buyer", "buyer");
  await deliver(event()).expect(200);

  await deliver(
    event({
      id: "evt_2",
      type: "EXPIRATION",
      expiration_reason: "UNSUBSCRIBE",
      expiration_at_ms: Date.now() - 1000,
    })
  ).expect(200);

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.equal(stored.status, "canceled");
  assert.equal((await User.findById(user._id).lean()).subscribed, false);
});

test("a billing issue inside the grace period keeps the entitlement", async () => {
  const [, user] = await signUp("buyer", "buyer");
  await deliver(event()).expect(200);

  // The store extends `expiration_at_ms` to the end of its grace period.
  await deliver(
    event({ id: "evt_2", type: "BILLING_ISSUE", expiration_at_ms: Date.now() + 7 * DAY })
  ).expect(200);

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.equal(stored.status, "past_due");
  assert.equal((await User.findById(user._id).lean()).subscribed, true);
});

test("an event without a price does not blank the price already stored", async () => {
  const [, user] = await signUp("buyer", "buyer");
  await deliver(event()).expect(200);

  await deliver(
    event({ id: "evt_2", type: "BILLING_ISSUE", price: undefined, currency: undefined })
  ).expect(200);

  assert.equal((await Subscription.findOne({ user: user._id }).lean()).amount, 4.99);
});

test("a transfer takes the entitlement from one account and gives it to the other", async () => {
  const [, from] = await signUp("old-phone", "oldphone");
  const [, to] = await signUp("new-phone", "newphone");
  await deliver(event({ app_user_id: "old-phone" })).expect(200);

  await deliver({
    api_version: "1.0",
    event: {
      id: "evt_t",
      type: "TRANSFER",
      store: "APP_STORE",
      transferred_from: ["old-phone"],
      transferred_to: ["new-phone"],
    },
  }).expect(200);

  assert.equal((await User.findById(from._id).lean()).subscribed, false);
  assert.equal((await Subscription.findOne({ user: from._id }).lean()).status, "canceled");
  assert.equal((await User.findById(to._id).lean()).subscribed, true);
});

// --- Acknowledged, not acted on --------------------------------------------

test("an unknown app user id is acknowledged rather than retried for days", async () => {
  const res = await deliver(event({ app_user_id: "nobody-here" }));
  assert.equal(res.status, 200);
  assert.equal(await Subscription.countDocuments(), 0);
});

test("TEST and unrecognised event types are acknowledged", async () => {
  await signUp("buyer", "buyer");
  assert.equal((await deliver(event({ type: "TEST" }))).status, 200);
  assert.equal((await deliver(event({ type: "SOMETHING_NEW" }))).status, 200);
  assert.equal(await Subscription.countDocuments(), 0);
});

// --- Reads -----------------------------------------------------------------

test("/me and /history are the caller's own", async () => {
  const [mine, me] = await signUp("buyer", "buyer");
  const [theirs] = await signUp("other", "other");
  await deliver(event()).expect(200);

  const current = await request(app).get("/api/subscriptions/me").set(...mine);
  assert.equal(current.status, 200);
  assert.equal(String(current.body.user), String(me._id));

  const history = await request(app).get("/api/subscriptions/history").set(...mine);
  assert.equal(history.body.length, 1);

  const none = await request(app).get("/api/subscriptions/me").set(...theirs);
  assert.equal(none.body, null);
  const empty = await request(app).get("/api/subscriptions/history").set(...theirs);
  assert.deepEqual(empty.body, []);
});

test("checkSubscriptionStatus answers from the flag the webhook maintains", async () => {
  const SubscriptionController = require("../controllers/SubscriptionController");
  const [, user] = await signUp("buyer", "buyer");

  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), false);
  await deliver(event()).expect(200);
  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), true);
  await deliver(event({ id: "evt_2", type: "EXPIRATION" })).expect(200);
  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), false);
});

test("a client still cannot write the subscription routes", async () => {
  const [header] = await signUp("buyer", "buyer");
  // The create/cancel/resume endpoints are gone with Stripe; a POST here is a
  // 404, not a way in.
  assert.equal((await request(app).post("/api/subscriptions").set(...header).send({})).status, 404);
  assert.equal((await request(app).post("/api/subscriptions/cancel").set(...header)).status, 404);
});

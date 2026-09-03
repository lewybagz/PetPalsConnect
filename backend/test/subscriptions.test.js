const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Subscription;
let stripeStub;

/**
 * Stripe is stubbed at the config boundary, the same way Firebase is - so the
 * controller, routes and persistence are all real code.
 */
test.before(async () => {
  stripeStub = harness.stubStripe();
  app = await harness.start();
  User = require("../models/User");
  Subscription = require("../models/Subscription");

  process.env.STRIPE_PRICE_MONTHLY = "price_monthly_test";
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  stripeStub.reset();
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

test("the plan list reports which plans are actually configured", async () => {
  const [header] = await signUp("plans-user", "plansuser");

  const res = await request(app).get("/api/subscriptions/plans").set(...header);

  assert.equal(res.status, 200);
  const monthly = res.body.plans.find((plan) => plan.id === "monthly");
  assert.equal(monthly.available, true);
  // Yearly has no price id set, so it must not be offered as purchasable.
  const yearly = res.body.plans.find((plan) => plan.id === "yearly");
  assert.equal(yearly.available, false);
});

test("subscribing returns what PaymentSheet needs", async () => {
  const [header] = await signUp("sub-user", "subuser");

  const res = await request(app)
    .post("/api/subscriptions")
    .set(...header)
    .send({ planId: "monthly" });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.clientSecret, "PaymentSheet needs a client secret");
  assert.ok(res.body.ephemeralKey, "PaymentSheet needs an ephemeral key");
  assert.ok(res.body.customerId);
});

test("the price comes from the server, never the request body", async () => {
  const [header] = await signUp("price-user", "priceuser");

  await request(app)
    .post("/api/subscriptions")
    .set(...header)
    .send({ planId: "monthly", amount: 1, priceId: "price_one_penny" })
    .expect(201);

  // Whatever the client sent, Stripe must be asked for the configured price.
  const created = stripeStub.calls.subscriptionsCreate.at(-1);
  assert.equal(created.items[0].price, "price_monthly_test");
});

test("an unknown plan is refused", async () => {
  const [header] = await signUp("bad-plan", "badplan");

  const res = await request(app)
    .post("/api/subscriptions")
    .set(...header)
    .send({ planId: "free-forever" });

  assert.equal(res.status, 400);
  assert.equal(stripeStub.calls.subscriptionsCreate.length, 0);
});

test("a plan with no configured price is refused rather than half-working", async () => {
  const [header] = await signUp("yearly-user", "yearlyuser");

  const res = await request(app)
    .post("/api/subscriptions")
    .set(...header)
    .send({ planId: "yearly" });

  assert.equal(res.status, 400);
});

test("the Stripe customer is created once and reused", async () => {
  const [header, user] = await signUp("reuse-user", "reuseuser");

  await request(app).post("/api/subscriptions").set(...header).send({ planId: "monthly" }).expect(201);

  const stored = await User.findById(user._id).lean();
  assert.ok(stored.stripeCustomerId, "the customer id should be remembered");

  await Subscription.deleteMany({});
  await request(app).post("/api/subscriptions").set(...header).send({ planId: "monthly" }).expect(201);

  assert.equal(
    stripeStub.calls.customersCreate.length,
    1,
    "a second subscription should not create a second customer"
  );
});

test("subscribing twice is refused while one is active", async () => {
  const [header, user] = await signUp("double-user", "doubleuser");
  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "active",
    stripeSubscriptionId: "sub_existing",
  });

  const res = await request(app)
    .post("/api/subscriptions")
    .set(...header)
    .send({ planId: "monthly" });

  assert.equal(res.status, 409);
});

test("a new subscription is persisted and marks the user subscribed", async () => {
  const [header, user] = await signUp("persist-user", "persistuser");

  stripeStub.subscriptionStatus = "active";
  await request(app).post("/api/subscriptions").set(...header).send({ planId: "monthly" }).expect(201);

  const stored = await Subscription.findOne({ user: user._id }).lean();
  assert.ok(stored);
  assert.equal(stored.status, "active");

  const refreshed = await User.findById(user._id).lean();
  assert.equal(refreshed.subscribed, true);
});

test("cancelling cancels at period end rather than deleting", async () => {
  const [header, user] = await signUp("cancel-user", "canceluser");
  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "active",
    stripeSubscriptionId: "sub_cancel_me",
  });

  const res = await request(app).post("/api/subscriptions/cancel").set(...header);

  assert.equal(res.status, 200);
  // Deleting immediately would take away time the user has already paid for.
  const update = stripeStub.calls.subscriptionsUpdate.at(-1);
  assert.equal(update.params.cancel_at_period_end, true);
});

test("cancelling without a subscription is a 404, not a crash", async () => {
  const [header] = await signUp("nothing-user", "nothinguser");
  const res = await request(app).post("/api/subscriptions/cancel").set(...header);
  assert.equal(res.status, 404);
});

test("checkSubscriptionStatus is true only for a live subscription", async () => {
  const SubscriptionController = require("../controllers/SubscriptionController");
  const [, user] = await signUp("status-user", "statususer");

  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), false);

  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "active",
    endDate: new Date(Date.now() + 86400000),
  });
  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), true);

  await Subscription.updateOne({ user: user._id }, { status: "canceled" });
  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), false);
});

test("an expired subscription does not count as active", async () => {
  const SubscriptionController = require("../controllers/SubscriptionController");
  const [, user] = await signUp("expired-user", "expireduser");

  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "active",
    endDate: new Date(Date.now() - 86400000),
  });

  assert.equal(await SubscriptionController.checkSubscriptionStatus(user._id), false);
});

// --- Webhooks -------------------------------------------------------------

test("a webhook with a bad signature is rejected", async () => {
  stripeStub.failSignature = true;

  const res = await request(app)
    .post("/api/stripe-webhooks")
    .set("stripe-signature", "nonsense")
    .send({});

  assert.equal(res.status, 400);
});

test("a subscription webhook updates the stored record", async () => {
  const [, user] = await signUp("hook-user", "hookuser");
  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "incomplete",
    stripeSubscriptionId: "sub_hook",
  });

  stripeStub.nextEvent = {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_hook",
        customer: "cus_hook",
        status: "active",
        cancel_at_period_end: false,
        items: { data: [{ price: { id: "price_monthly_test", unit_amount: 999, currency: "usd", recurring: { interval: "month" } } }] },
      },
    },
  };

  const res = await request(app)
    .post("/api/stripe-webhooks")
    .set("stripe-signature", "valid")
    .send({});

  assert.equal(res.status, 200);

  const stored = await Subscription.findOne({ stripeSubscriptionId: "sub_hook" }).lean();
  assert.equal(stored.status, "active");
  assert.equal(stored.amount, 9.99);

  const refreshed = await User.findById(user._id).lean();
  assert.equal(refreshed.subscribed, true);
});

test("a cancellation webhook clears the user's entitlement", async () => {
  const [, user] = await signUp("revoke-user", "revokeuser");
  await Subscription.create({
    user: user._id,
    planType: "month",
    status: "active",
    stripeSubscriptionId: "sub_revoke",
  });
  await User.updateOne({ _id: user._id }, { subscribed: true });

  stripeStub.nextEvent = {
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_revoke",
        customer: "cus_revoke",
        status: "canceled",
        items: { data: [] },
      },
    },
  };

  await request(app)
    .post("/api/stripe-webhooks")
    .set("stripe-signature", "valid")
    .expect(200);

  const refreshed = await User.findById(user._id).lean();
  assert.equal(refreshed.subscribed, false);
});

test("an unrecognised webhook is acknowledged rather than retried forever", async () => {
  stripeStub.nextEvent = { type: "some.other.event", data: { object: {} } };

  const res = await request(app)
    .post("/api/stripe-webhooks")
    .set("stripe-signature", "valid")
    .send({});

  assert.equal(res.status, 200);
});

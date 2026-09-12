const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const Stripe = require("stripe");

const harness = require("./helpers/harness");

let app;
let User;
let Order;
let Notification;
let stripeConfig;
let checkout;
let stripeOrders;

const SECRET = "sk_test_store_suite";
const WEBHOOK_SECRET = "whsec_store_suite";

/**
 * The shop.
 *
 * Stripe is the source of truth and its webhook is the only writer of an
 * order, so nearly everything here is a webhook delivery and what the database
 * says afterwards. The route, the sync and the persistence are real; the
 * network half of the Stripe client is a stub, and the signature helpers are
 * the real ones - `constructEvent` runs offline and is exactly what the route
 * calls.
 */

/** The Stripe objects the stub answers with, settable per test. */
const stub = {
  prices: [],
  lineItems: [],
  createdSessions: [],
};

const PRICES = {
  "tee-m": { id: "price_tee_m", lookup_key: "tee-m", unit_amount: 2800, currency: "usd", active: true },
  "collar-tracker-m": {
    id: "price_collar_m",
    lookup_key: "collar-tracker-m",
    unit_amount: 12900,
    currency: "usd",
    active: true,
  },
};

const fakeStripe = () => {
  const real = new Stripe(SECRET);
  return {
    webhooks: real.webhooks,
    prices: {
      list: async ({ lookup_keys }) => ({
        data: stub.prices.filter((price) => lookup_keys.includes(price.lookup_key)),
      }),
    },
    checkout: {
      sessions: {
        create: async (params) => {
          stub.createdSessions.push(params);
          return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
        },
        listLineItems: async () => ({ data: stub.lineItems }),
      },
    },
  };
};

test.before(async () => {
  process.env.STRIPE_SECRET_KEY = SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  app = await harness.start();
  User = require("../models/User");
  Order = require("../models/Order");
  Notification = require("../models/Notification");
  stripeConfig = require("../config/stripe");
  checkout = require("../services/store/checkout");
  stripeOrders = require("../services/store/stripeOrders");
  stripeConfig.setClient(fakeStripe());
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  stub.prices = Object.values(PRICES);
  stub.lineItems = [];
  stub.createdSessions = [];
  checkout.resetPriceCache();
  delete process.env.MODERATOR_EMAILS;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = async (uid, username = uid) => {
  const user = await User.create({
    firebaseUid: uid,
    username,
    email: `${uid}@example.test`,
  });
  return [auth(uid), user];
};

/** A signed delivery, the way Stripe would send it. */
const deliver = (event, secret = WEBHOOK_SECRET) => {
  const payload = JSON.stringify(event);
  const header = new Stripe(SECRET).webhooks.generateTestHeaderString({ payload, secret });
  return request(app)
    .post("/api/stripe-webhooks")
    .set("stripe-signature", header)
    .set("Content-Type", "application/json")
    .send(payload);
};

const session = (user, overrides = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  payment_intent: "pi_1",
  client_reference_id: String(user._id),
  metadata: { userId: String(user._id) },
  amount_subtotal: 2800,
  amount_total: 3100,
  currency: "usd",
  total_details: { amount_tax: 300, amount_shipping: 0 },
  customer_details: { email: `${user.username}@example.test` },
  collected_information: {
    shipping_details: {
      name: "Buyer Person",
      address: { line1: "1 Main St", city: "Phoenix", state: "AZ", postal_code: "85001", country: "US" },
    },
  },
  livemode: false,
  ...overrides,
});

const completed = (user, overrides = {}, id = "evt_1") => ({
  id,
  type: "checkout.session.completed",
  data: { object: session(user, overrides) },
});

const teeLine = () => ({
  description: "PetPals Tee",
  quantity: 1,
  currency: "usd",
  price: PRICES["tee-m"],
});

// --- The catalogue -----------------------------------------------------------

test("the catalogue carries live prices, and null where Stripe has none", async () => {
  const [header] = await signUp("shopper");

  const res = await request(app).get("/api/store/products").set(...header);
  assert.equal(res.status, 200);
  assert.equal(res.body.configured, true);

  const tee = res.body.products.find((p) => p.id === "tee");
  assert.deepEqual(tee.variants.find((v) => v.sku === "tee-m").price, {
    amount: 2800,
    currency: "usd",
  });
  assert.equal(tee.variants.find((v) => v.sku === "tee-s").price, null);
});

test("no product in the catalogue grants an entitlement", () => {
  const { PRODUCTS } = require("../services/store/products");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../services/store/products.js"),
    "utf8"
  );
  // Physical goods go through Stripe because IAP is forbidden for them; a
  // product that also unlocked in-app content would be digital content sold
  // outside IAP. The word must not appear in the table at all.
  assert.ok(!/entitlement\s*:/.test(source), "a product names an entitlement");
  for (const product of PRODUCTS) {
    assert.ok(!("entitlement" in product));
    for (const variant of product.variants) assert.ok(!("entitlement" in variant));
  }
});

test("every sku is unique across the catalogue", () => {
  const { allSkus } = require("../services/store/products");
  const skus = allSkus();
  assert.equal(new Set(skus).size, skus.length);
});

// --- Checkout ----------------------------------------------------------------

test("checkout hands Stripe price ids and quantities, never an amount from the client", async () => {
  const [header] = await signUp("shopper");

  const res = await request(app)
    .post("/api/store/checkout")
    .set(...header)
    .send({
      items: [
        // A client-supplied price is ignored, not honoured.
        { sku: "tee-m", quantity: 2, price: 1, unit_amount: 1 },
        { sku: "tee-m", quantity: 1 },
      ],
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.url, "https://checkout.stripe.test/cs_test_1");

  const [params] = stub.createdSessions;
  assert.deepEqual(params.line_items, [{ price: "price_tee_m", quantity: 3 }]);
  assert.equal(JSON.stringify(params).includes("unit_amount"), false);
  assert.equal(params.mode, "payment");
  assert.equal(params.automatic_tax.enabled, true);
  assert.deepEqual(params.shipping_address_collection.allowed_countries, ["US"]);
  assert.match(params.success_url, /^petpalsconnect:\/\/store\/order\/\{CHECKOUT_SESSION_ID\}$/);
});

test("the buyer on the session is the caller, from the token", async () => {
  const [header, user] = await signUp("shopper");
  const [, other] = await signUp("other");

  await request(app)
    .post("/api/store/checkout")
    .set(...header)
    .send({ items: [{ sku: "tee-m" }], userId: String(other._id), user: String(other._id) });

  const [params] = stub.createdSessions;
  assert.equal(params.client_reference_id, String(user._id));
  assert.equal(params.metadata.userId, String(user._id));
});

test("an unknown sku, a bad quantity and an empty order are 400s", async () => {
  const [header] = await signUp("shopper");
  const post = (body) => request(app).post("/api/store/checkout").set(...header).send(body);

  assert.equal((await post({ items: [{ sku: "not-a-thing" }] })).status, 400);
  assert.equal((await post({ items: [{ sku: "tee-m", quantity: 0 }] })).status, 400);
  assert.equal((await post({ items: [{ sku: "tee-m", quantity: 1.5 }] })).status, 400);
  assert.equal((await post({ items: [{ sku: "tee-m", quantity: 11 }] })).status, 400);
  assert.equal((await post({ items: [] })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal(stub.createdSessions.length, 0);
});

test("a sku with no Price in Stripe is not for sale", async () => {
  const [header] = await signUp("shopper");

  const res = await request(app)
    .post("/api/store/checkout")
    .set(...header)
    .send({ items: [{ sku: "tee-s" }] });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, "NOT_FOR_SALE");
});

test("without Stripe the catalogue still lists and checkout says the shop is closed", async () => {
  const [header] = await signUp("shopper");
  stripeConfig.setClient(null);
  try {
    const list = await request(app).get("/api/store/products").set(...header);
    assert.equal(list.status, 200);
    assert.equal(list.body.configured, false);
    assert.ok(list.body.products.every((p) => p.variants.every((v) => v.price === null)));

    const buy = await request(app)
      .post("/api/store/checkout")
      .set(...header)
      .send({ items: [{ sku: "tee-m" }] });
    assert.equal(buy.status, 503);

    const hook = await deliver(completed({ _id: "000000000000000000000000", username: "x" }));
    assert.equal(hook.status, 503);
  } finally {
    stripeConfig.setClient(fakeStripe());
  }
});

// --- The webhook -------------------------------------------------------------

test("a delivery with a bad signature is refused and writes nothing", async () => {
  const [, user] = await signUp("buyer");

  assert.equal((await deliver(completed(user), "whsec_wrong")).status, 400);
  assert.equal(
    (
      await request(app)
        .post("/api/stripe-webhooks")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(completed(user)))
    ).status,
    400
  );
  assert.equal(await Order.countDocuments(), 0);
});

test("a completed session becomes a paid order with Stripe's own line items", async () => {
  const [header, user] = await signUp("buyer");
  stub.lineItems = [teeLine()];

  const res = await deliver(completed(user));
  assert.equal(res.status, 200);

  const order = await Order.findOne({ user: user._id }).lean();
  assert.equal(order.status, "paid");
  assert.equal(order.paymentIntentId, "pi_1");
  assert.equal(order.stripeSessionId, "cs_test_1");
  assert.equal(order.amountTotal, 3100);
  assert.equal(order.amountTax, 300);
  assert.equal(order.shipping.city, "Phoenix");
  assert.equal(order.shipping.postalCode, "85001");
  assert.deepEqual(
    order.items.map(({ sku, name, quantity, unitAmount, productId, variantLabel }) => ({
      sku,
      name,
      quantity,
      unitAmount,
      productId,
      variantLabel,
    })),
    [{ sku: "tee-m", name: "PetPals Tee", quantity: 1, unitAmount: 2800, productId: "tee", variantLabel: "M" }]
  );

  // And the buyer can read it back, by id and by the session they returned with.
  const mine = await request(app).get("/api/store/orders").set(...header);
  assert.equal(mine.body.length, 1);
  const bySession = await request(app)
    .get("/api/store/orders/by-session/cs_test_1")
    .set(...header);
  assert.equal(bySession.status, 200);
  assert.equal(bySession.body._id, String(order._id));
});

test("a duplicate delivery lands on the same row", async () => {
  const [, user] = await signUp("buyer");
  stub.lineItems = [teeLine()];

  await deliver(completed(user));
  await deliver(completed(user));
  await deliver(completed(user, {}, "evt_retry"));

  assert.equal(await Order.countDocuments(), 1);
});

test("an unpaid session is pending, and the async result finishes it either way", async () => {
  const [, user] = await signUp("buyer");
  stub.lineItems = [teeLine()];

  await deliver(completed(user, { payment_status: "unpaid" }));
  assert.equal((await Order.findOne().lean()).status, "pending");

  await deliver({
    id: "evt_2",
    type: "checkout.session.async_payment_succeeded",
    data: { object: session(user) },
  });
  assert.equal((await Order.findOne().lean()).status, "paid");

  await deliver({
    id: "evt_3",
    type: "checkout.session.async_payment_failed",
    data: { object: session(user, { payment_status: "unpaid" }) },
  });
  assert.equal((await Order.findOne().lean()).status, "failed");
  assert.equal(await Order.countDocuments(), 1);
});

test("a refund and a dispute reach the order through the payment intent", async () => {
  const [, user] = await signUp("buyer");
  stub.lineItems = [teeLine()];
  await deliver(completed(user));

  // A partial refund is a note; a full one ends it.
  await deliver({
    id: "evt_r1",
    type: "charge.refunded",
    data: { object: { object: "charge", payment_intent: "pi_1", amount_refunded: 500, refunded: false } },
  });
  let order = await Order.findOne().lean();
  assert.equal(order.status, "paid");
  assert.equal(order.amountRefunded, 500);

  await deliver({
    id: "evt_r2",
    type: "charge.refunded",
    data: { object: { object: "charge", payment_intent: "pi_1", amount_refunded: 3100, refunded: true } },
  });
  order = await Order.findOne().lean();
  assert.equal(order.status, "refunded");
  assert.ok(order.refundedAt);

  await deliver({
    id: "evt_d1",
    type: "charge.dispute.created",
    data: { object: { object: "dispute", payment_intent: "pi_1" } },
  });
  assert.equal((await Order.findOne().lean()).status, "disputed");
});

test("events we do not act on, and sessions for nobody, are acknowledged", async () => {
  assert.equal((await deliver({ id: "e", type: "payment_intent.created", data: { object: {} } })).status, 200);
  assert.equal(
    (
      await deliver(
        completed({ _id: "000000000000000000000000", username: "ghost" })
      )
    ).status,
    200
  );
  // A subscription-mode session is RevenueCat's world, never ours.
  const [, user] = await signUp("buyer");
  assert.equal((await deliver(completed(user, { mode: "subscription" }))).status, 200);
  assert.equal(await Order.countDocuments(), 0);
});

test("the webhook never touches the subscription flag", async () => {
  const [, user] = await signUp("buyer");
  stub.lineItems = [teeLine()];
  await deliver(completed(user));
  assert.equal((await User.findById(user._id).lean()).subscribed, false);
});

// --- Reading orders ----------------------------------------------------------

test("an order is the buyer's own; anybody else gets 404", async () => {
  const [, buyer] = await signUp("buyer");
  const [otherHeader] = await signUp("other");
  stub.lineItems = [teeLine()];
  await deliver(completed(buyer));
  const order = await Order.findOne().lean();

  const list = await request(app).get("/api/store/orders").set(...otherHeader);
  assert.deepEqual(list.body, []);
  assert.equal(
    (await request(app).get(`/api/store/orders/${order._id}`).set(...otherHeader)).status,
    404
  );
  assert.equal(
    (await request(app).get("/api/store/orders/by-session/cs_test_1").set(...otherHeader)).status,
    404
  );
});

test("an order that has not landed yet is a 404 the app reads as 'confirming'", async () => {
  const [header] = await signUp("buyer");
  const res = await request(app).get("/api/store/orders/by-session/cs_nope").set(...header);
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "NOT_YET");
});

// --- Fulfilment --------------------------------------------------------------

test("marking an order shipped is moderator-only and tells the buyer once", async () => {
  const [buyerHeader, buyer] = await signUp("buyer");
  const [opsHeader] = await signUp("ops");
  stub.lineItems = [teeLine()];
  await deliver(completed(buyer));
  const order = await Order.findOne().lean();

  const url = `/api/store/orders/${order._id}/fulfilled`;
  // The buyer cannot ship their own order, and a non-moderator sees no route.
  assert.equal((await request(app).post(url).set(...buyerHeader).send({})).status, 404);

  process.env.MODERATOR_EMAILS = "ops@example.test";
  const shipped = await request(app)
    .post(url)
    .set(...opsHeader)
    .send({ carrier: "USPS", trackingNumber: "9400 1000 0000 0000 0000 00" });
  assert.equal(shipped.status, 200);
  assert.equal(shipped.body.status, "fulfilled");
  assert.equal(shipped.body.carrier, "USPS");

  // Idempotent, and one notification, not two.
  await request(app).post(url).set(...opsHeader).send({});
  const notes = await Notification.find({ recipient: buyer._id }).lean();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].type, "orderShipped");
  assert.match(notes[0].content, /PetPals Tee is on its way/);
});

test("only a paid order can be fulfilled", async () => {
  const [, buyer] = await signUp("buyer");
  stub.lineItems = [teeLine()];
  await deliver(completed(buyer, { payment_status: "unpaid" }));
  const order = await Order.findOne().lean();

  await assert.rejects(() => stripeOrders.markFulfilled(order._id), /paid/);
});

// --- Retention ---------------------------------------------------------------

test("orders are kept seven years, longer than reports", async () => {
  const retention = require("../services/retention");
  const [, buyer] = await signUp("buyer");
  const DAY = 86400000;
  const now = new Date("2040-01-01T00:00:00Z");

  assert.equal(retention.ORDER_RETENTION_DAYS, 7 * 365);
  assert.ok(retention.ORDER_RETENTION_DAYS > retention.RETENTION_DAYS);

  const make = (createdDate, paymentIntentId) =>
    Order.create({ user: buyer._id, paymentIntentId, status: "paid", createdDate });
  await make(new Date(now - (retention.ORDER_RETENTION_DAYS + 1) * DAY), "pi_old");
  await make(new Date(now - (retention.ORDER_RETENTION_DAYS - 1) * DAY), "pi_recent");
  // Older than the report window but inside the order window: stays.
  await make(new Date(now - (retention.RETENTION_DAYS + 1) * DAY), "pi_mid");

  const result = await retention.purgeExpired(now);
  assert.equal(result.orders, 1);
  assert.equal(await Order.countDocuments(), 2);
});

test("an order survives account deletion as a financial record", async () => {
  const [header, buyer] = await signUp("buyer");
  stub.lineItems = [teeLine()];
  await deliver(completed(buyer));

  const res = await request(app).delete("/api/users/me").set(...header);
  assert.equal(res.status, 200);
  assert.equal(await User.countDocuments({ _id: buyer._id }), 0);
  assert.equal(await Order.countDocuments({ user: buyer._id }), 1);
});

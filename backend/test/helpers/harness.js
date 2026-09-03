/**
 * Test harness.
 *
 * Boots the real Express app against an in-memory MongoDB with a stubbed
 * Firebase Admin, so the suite needs no database, no service-account key and no
 * network. Everything else - routing, middleware, controllers, schemas - is the
 * production code path.
 */
const Module = require("node:module");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

/** The token -> decoded-claims table the Firebase stub answers from. */
const tokens = new Map();

/** Registers a fake ID token. Use the returned string as a Bearer token. */
const issueToken = (uid, claims = {}) => {
  const token = `test-token-${uid}`;
  tokens.set(token, { uid, email: `${uid}@example.test`, ...claims });
  return token;
};

const firebaseStub = {
  admin: {},
  isEnabled: () => true,
  verifyIdToken: async (token) => {
    const decoded = tokens.get(token);
    if (!decoded) {
      const error = new Error("Invalid token");
      error.code = "auth/argument-error";
      throw error;
    }
    return decoded;
  },
  sent: [],
  sendMessage: async (message) => {
    firebaseStub.sent.push(message);
    return "stub-message-id";
  },
};

/**
 * Seeds require.cache so `require("../config/firebase")` resolves to the stub.
 * Done before the app is loaded, this needs no production-code seam.
 */
const stubFirebase = () => seedModule("../../config/firebase", firebaseStub);

/**
 * A stand-in for `config/stripe`.
 *
 * Only the calls the controller and webhook route actually make are
 * implemented, and every one records its arguments so a test can assert what
 * was sent to Stripe - which is the point: the price must come from the server,
 * cancelling must not delete, and the customer must be reused.
 */
const makeStripeStub = () => {
  const stub = {
    subscriptionStatus: "incomplete",
    failSignature: false,
    nextEvent: null,
    calls: {
      customersCreate: [],
      subscriptionsCreate: [],
      subscriptionsUpdate: [],
      subscriptionsRetrieve: [],
      ephemeralKeysCreate: [],
    },
    reset() {
      stub.subscriptionStatus = "incomplete";
      stub.failSignature = false;
      stub.nextEvent = null;
      for (const key of Object.keys(stub.calls)) stub.calls[key] = [];
      stub.customerSeq = 0;
      stub.subscriptionSeq = 0;
    },
    customerSeq: 0,
    subscriptionSeq: 0,
  };

  /** Shaped like a real Stripe subscription, down to the expanded invoice. */
  const subscriptionObject = (id, { priceId, status, cancelAtPeriodEnd, customer }) => {
    const now = Math.floor(Date.now() / 1000);
    return {
      id,
      object: "subscription",
      customer: customer ?? "cus_stub_1",
      status: status ?? stub.subscriptionStatus,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      current_period_start: now,
      current_period_end: now + 30 * 24 * 60 * 60,
      items: {
        data: [
          {
            price: {
              id: priceId ?? "price_monthly_test",
              unit_amount: 999,
              currency: "usd",
              recurring: { interval: "month" },
            },
          },
        ],
      },
      latest_invoice: {
        id: `in_${id}`,
        payment_intent: {
          id: `pi_${id}`,
          client_secret: `pi_${id}_secret_stub`,
        },
      },
    };
  };

  const client = {
    customers: {
      create: async (params) => {
        stub.calls.customersCreate.push(params);
        stub.customerSeq += 1;
        return { id: `cus_stub_${stub.customerSeq}`, ...params };
      },
    },
    subscriptions: {
      create: async (params) => {
        stub.calls.subscriptionsCreate.push(params);
        stub.subscriptionSeq += 1;
        return subscriptionObject(`sub_stub_${stub.subscriptionSeq}`, {
          priceId: params.items?.[0]?.price,
          customer: params.customer,
        });
      },
      update: async (id, params) => {
        stub.calls.subscriptionsUpdate.push({ id, params });
        return subscriptionObject(id, {
          status: "active",
          cancelAtPeriodEnd: params.cancel_at_period_end,
        });
      },
      retrieve: async (id) => {
        stub.calls.subscriptionsRetrieve.push(id);
        return subscriptionObject(id, {});
      },
    },
    ephemeralKeys: {
      create: async (params, options) => {
        stub.calls.ephemeralKeysCreate.push({ params, options });
        return { id: "ephkey_stub", secret: "ek_test_stub_secret" };
      },
    },
    webhooks: {
      constructEvent: (body, signature, secret) => {
        if (stub.failSignature || !signature || !secret) {
          throw new Error("No signatures found matching the expected signature");
        }
        return stub.nextEvent ?? { type: "some.other.event", data: { object: {} } };
      },
    },
  };

  stub.client = client;
  stub.exports = {
    getStripe: () => client,
    isEnabled: () => true,
    webhookSecret: "whsec_test_stub",
  };

  return stub;
};

/** Replaces a module in require.cache with a stub, before the app loads it. */
const seedModule = (specifier, exports) => {
  const resolved = require.resolve(specifier);
  const stubModule = new Module(resolved);
  stubModule.filename = resolved;
  stubModule.loaded = true;
  stubModule.exports = exports;
  require.cache[resolved] = stubModule;
};

/**
 * Stubs Stripe at the `config/stripe` boundary so the controller, routes,
 * webhook signature check and persistence are all real code. Call before
 * `start()` - the routes destructure `webhookSecret` at load time.
 */
const stubStripe = () => {
  const stub = makeStripeStub();
  seedModule("../../config/stripe", stub.exports);
  return stub;
};

/** Starts in-memory Mongo, stubs Firebase, and returns the Express app. */
const start = async () => {
  mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri("petpals_test");
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";

  stubFirebase();

  const db = require("../../config/db");
  await db.connect();

  const { app } = require("../../Server");

  // Mongoose builds indexes in the background, so without this a unique-index
  // test can pass simply because the index does not exist yet.
  const mongoose = require("mongoose");
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );

  return app;
};

const stop = async () => {
  const mongoose = require("mongoose");
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
};

/** Empties every collection between tests. */
const clear = async () => {
  const mongoose = require("mongoose");
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

module.exports = { start, stop, clear, issueToken, stubStripe, firebaseStub, tokens };

/**
 * Test harness.
 *
 * Boots the real Express app against an in-memory MongoDB with a stubbed
 * Firebase Admin, so the suite needs no database, no service-account key and no
 * network. Everything else - routing, middleware, controllers, schemas - is the
 * production code path.
 */
const Module = require("node:module");
const path = require("node:path");
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
 * Tokens the caller has "revoked", by uid.
 *
 * `resolveCaller` asks Firebase whether an account has been disabled or its
 * refresh tokens revoked, on a schedule rather than per request. The stub above
 * answers that question so the behaviour can be tested without a real project.
 */
const revoked = new Set();

/** Counted so a test can prove the check is cached rather than per request. */
firebaseStub.revocationChecks = 0;

firebaseStub.verifyIdToken = async (token, { checkRevoked = false } = {}) => {
  if (checkRevoked) firebaseStub.revocationChecks += 1;

  const decoded = tokens.get(token);
  if (!decoded) {
    const error = new Error("Invalid token");
    error.code = "auth/argument-error";
    throw error;
  }
  if (checkRevoked && revoked.has(decoded.uid)) {
    const error = new Error("The ID token has been revoked");
    error.code = "auth/id-token-revoked";
    throw error;
  }
  return decoded;
};

/** Marks an account's sessions revoked, the way disabling it would. */
const revokeTokens = (uid) => revoked.add(uid);
const unrevokeTokens = (uid) => revoked.delete(uid);

/**
 * Replaces a module in require.cache with a stub, before the app loads it.
 * Done ahead of the first require, this needs no production-code seam.
 */
const seedModule = (specifier, exports) => {
  const resolved = require.resolve(specifier);
  const stubModule = new Module(resolved);
  stubModule.filename = resolved;
  stubModule.loaded = true;
  stubModule.exports = exports;
  require.cache[resolved] = stubModule;
};

const stubFirebase = () => seedModule("../../config/firebase", firebaseStub);

/**
 * A database name of this test file's own.
 *
 * Under `node --test` each file is its own process and its own main module, so
 * the filename is both stable and unique. Two files sharing one server must not
 * share a database - `clear()` between tests would then be emptying somebody
 * else's collections.
 */
const databaseName = () => {
  const entry = process.argv[1] ?? "";
  const file = path.basename(entry, ".js").replace(/\.test$/, "");
  return `petpals_${file.replace(/[^\w]/g, "_") || "test"}`;
};

/**
 * Starts in-memory Mongo, stubs Firebase, and returns the Express app.
 *
 * `MONGO_TEST_URI` is set by `scripts/test.js`, which starts one server for the
 * whole run. Without it - `node --test test/auth.test.js`, or an editor running
 * one file - this falls back to a server of its own, so a single file is still
 * runnable on its own.
 */
const start = async () => {
  const shared = process.env.MONGO_TEST_URI;

  if (shared) {
    process.env.MONGODB_URI = new URL(databaseName(), shared).toString();
  } else {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri(databaseName());
  }
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";

  stubFirebase();

  const db = require("../../config/db");
  await db.connect();

  const { app } = require("../../Server");

  // Off by default: the suite makes hundreds of requests from one address, and
  // a limiter counting them would fail tests that are about something else.
  // `rateLimits.test.js` turns them back on for its own cases.
  require("../../middleware/rateLimits").setEnabled(false);

  // Mongoose builds indexes in the background, so without this a unique-index
  // test can pass simply because the index does not exist yet.
  const mongoose = require("mongoose");
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );

  return app;
};

/**
 * Drops this file's database and disconnects.
 *
 * The server itself is only stopped when this file started one. On a shared
 * server `scripts/test.js` owns that, including on Ctrl-C - which is what keeps
 * `mongo-mem-*` directories and stale socket files out of /tmp.
 */
const stop = async () => {
  const mongoose = require("mongoose");
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
};

/** Empties every collection between tests. */
const clear = async () => {
  // Revocation answers are cached for five minutes per account; a test that
  // did not clear that would inherit the previous test's verdict.
  require("../../services/callerIdentity").resetRevocationCache();
  revoked.clear();
  const mongoose = require("mongoose");
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

module.exports = {
  start,
  stop,
  clear,
  issueToken,
  firebaseStub,
  tokens,
  revokeTokens,
  unrevokeTokens,
};

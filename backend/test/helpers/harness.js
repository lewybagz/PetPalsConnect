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
const stubFirebase = () => {
  const firebasePath = require.resolve("../../config/firebase");
  const stubModule = new Module(firebasePath);
  stubModule.filename = firebasePath;
  stubModule.loaded = true;
  stubModule.exports = firebaseStub;
  require.cache[firebasePath] = stubModule;
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

module.exports = { start, stop, clear, issueToken, firebaseStub, tokens };

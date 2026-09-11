const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const request = require("supertest");

const harness = require("./helpers/harness");

const BACKEND = path.resolve(__dirname, "..");

/**
 * The insurance card is a slot: nothing until a partner exists, and when one
 * does, a link that names who it opens. The config check is the rule - a URL
 * with no partner cannot be disclosed, so it cannot boot.
 *
 * `config/env.js` exits the process on a bad config, so it is loaded in a
 * subprocess the way `contract.test.js` loads Firebase.
 */
const loadEnv = (vars) =>
  spawnSync(
    process.execPath,
    ["-e", 'const env = require("./config/env"); console.log(JSON.stringify(env.insurance));'],
    {
      cwd: BACKEND,
      encoding: "utf8",
      env: {
        ...process.env,
        MONGODB_URI: "mongodb://localhost/unused",
        INSURANCE_COMPARE_URL: "",
        INSURANCE_PARTNER_NAME: "",
        ...vars,
      },
    }
  );

test("neither set: the slot is off", () => {
  const result = loadEnv({});
  assert.equal(result.status, 0, result.stderr);
  const insurance = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(insurance.enabled, false);
});

test("both set: the slot carries the partner's name with the link", () => {
  const result = loadEnv({
    INSURANCE_COMPARE_URL: "https://partner.example/compare?ref=petpals",
    INSURANCE_PARTNER_NAME: "Example Insure",
  });
  assert.equal(result.status, 0, result.stderr);
  const insurance = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.deepEqual(insurance, {
    enabled: true,
    url: "https://partner.example/compare?ref=petpals",
    partner: "Example Insure",
  });
});

test("a link with no partner name refuses to boot - it could not be disclosed", () => {
  const result = loadEnv({ INSURANCE_COMPARE_URL: "https://partner.example/compare" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be set together/);
});

test("a partner name with no link refuses to boot too", () => {
  const result = loadEnv({ INSURANCE_PARTNER_NAME: "Example Insure" });
  assert.notEqual(result.status, 0);
});

test("the link has to be https", () => {
  const result = loadEnv({
    INSURANCE_COMPARE_URL: "http://partner.example/compare",
    INSURANCE_PARTNER_NAME: "Example Insure",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /https/);
});

// ---------------------------------------------------------------------------
// Through the API
// ---------------------------------------------------------------------------

let app;
let User;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
});

test.after(async () => {
  await harness.stop();
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

test("the picks payload carries a null slot when there is no partner", async () => {
  await User.create({ firebaseUid: "owner", username: "owner", email: "owner@example.test" });

  const res = await request(app).get("/api/petcare/picks").set(...auth("owner")).expect(200);

  // The suite runs with neither variable set; the app renders no card for null.
  assert.equal(res.body.insurance, null);
});

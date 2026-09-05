const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const { scrub, isDangerousKey } = require("../middleware/sanitize");

let app;
let User;
let Pet;
let limits;

/**
 * The checks that sit behind every request.
 *
 * `authorisation.test.js` next door proves one account cannot read another's
 * rows. These are the layer under that: what happens before a controller is
 * reached at all - is this token still good, is this account still allowed in,
 * and is what it sent a query or a filter.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  limits = require("../middleware/rateLimits");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  limits.setEnabled(false);
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeUser = (uid, extra = {}) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    ...extra,
  });

// ---------------------------------------------------------------------------
// Suspension
// ---------------------------------------------------------------------------

/**
 * Suspension used to be a filter and nothing else. Three people reporting a
 * harasser removed them from discovery, the map and search - and left them able
 * to open a chat, send messages and file friend requests to everybody they had
 * already reached. It hid the account from strangers while doing nothing about
 * the people it was actually hurting.
 */
test("a suspended account cannot reach anything that touches another person", async () => {
  await makeUser("nuisance", { suspended: true });

  for (const [method, path] of [
    ["get", "/api/chats"],
    ["get", "/api/petmatches/discover"],
    ["get", "/api/notifications"],
    ["post", "/api/friendrequests"],
  ]) {
    const response = await request(app)[method](path).set(...auth("nuisance"));

    assert.equal(response.status, 403, `${method.toUpperCase()} ${path}`);
    assert.equal(response.body.code, "ACCOUNT_SUSPENDED");
  }
});

test("a suspended account can still read its own profile and delete itself", async () => {
  await makeUser("nuisance", { suspended: true });

  await request(app)
    .get("/api/users/me")
    .set(...auth("nuisance"))
    .expect(200);

  // Apple requires in-app deletion of any account the app let you create, and
  // being suspended is not an exemption from that.
  await request(app)
    .delete("/api/users/me")
    .set(...auth("nuisance"))
    .expect(200);
});

test("a suspended account can ask for a review, and reach nobody else", async () => {
  await makeUser("nuisance", { suspended: true });

  // Three distinct reporters hide an account automatically, and three
  // coordinated ones can do it to somebody who did nothing. A suspension with
  // no way to answer it is a permanent ban handed out by strangers.
  await request(app)
    .post("/api/supportmessages")
    .set(...auth("nuisance"))
    .send({ message: "Please review this." })
    .expect(201);

  // It is the only route that reaches anyone, and it reaches the operator.
  await request(app)
    .get("/api/supportmessages")
    .set(...auth("nuisance"))
    .expect(403);
});

test("a moderator's note about an account is not sent to that account", async () => {
  await makeUser("nuisance", {
    suspended: true,
    suspendedReason: "Reported by 3 people; awaiting review",
  });

  const response = await request(app)
    .get("/api/users/me")
    .set(...auth("nuisance"))
    .expect(200);

  // The count is a nudge towards working out who reported them.
  assert.equal(response.body.suspendedReason, undefined);
  assert.equal(response.body.suspended, true);
});

test("an ordinary account is untouched by any of it", async () => {
  await makeUser("regular");

  await request(app)
    .get("/api/chats")
    .set(...auth("regular"))
    .expect(200);
});

// ---------------------------------------------------------------------------
// Revoked and disabled sessions
// ---------------------------------------------------------------------------

/**
 * Verifying a token's signature is offline: it proves Firebase minted it and
 * that it has not expired, and says nothing about what has happened to the
 * account since. Without a revocation check, disabling an account leaves it
 * working for the rest of its token's hour - which is exactly the hour that
 * matters after a phone is stolen.
 */
test("a revoked session stops working", async () => {
  await makeUser("compromised");

  await request(app)
    .get("/api/users/me")
    .set(...auth("compromised"))
    .expect(200);

  harness.revokeTokens("compromised");
  require("../services/callerIdentity").resetRevocationCache();

  const refused = await request(app)
    .get("/api/users/me")
    .set(...auth("compromised"));

  assert.equal(refused.status, 401);
  assert.equal(refused.body.code, "SESSION_REVOKED");
});

test("a revoked session reads differently from an expired one", async () => {
  await makeUser("compromised");
  harness.revokeTokens("compromised");
  require("../services/callerIdentity").resetRevocationCache();

  const revoked = await request(app)
    .get("/api/users/me")
    .set(...auth("compromised"));
  const garbage = await request(app)
    .get("/api/users/me")
    .set("Authorization", "Bearer nonsense");

  // The client acts on these differently: refresh and retry for one, stop for
  // the other. Both are 401 so an old client still fails closed.
  assert.equal(revoked.body.code, "SESSION_REVOKED");
  assert.equal(garbage.body.code, "INVALID_TOKEN");
});

test("the revocation check is cached, not made on every request", async () => {
  await makeUser("chatty");
  const before = harness.firebaseStub.revocationChecks;

  for (let i = 0; i < 5; i += 1) {
    await request(app)
      .get("/api/users/me")
      .set(...auth("chatty"))
      .expect(200);
  }

  // Five requests, one round trip. Asking Firebase every time would put a
  // network hop in front of the entire API.
  assert.equal(harness.firebaseStub.revocationChecks - before, 1);
});

// ---------------------------------------------------------------------------
// Query-operator injection
// ---------------------------------------------------------------------------

test("operator keys are recognised and ordinary ones are not", () => {
  assert.ok(isDangerousKey("$ne"));
  assert.ok(isDangerousKey("profile.name"));
  assert.ok(!isDangerousKey("username"));
  assert.ok(!isDangerousKey("price$"));
});

test("scrub removes operators at any depth and leaves values alone", () => {
  const payload = {
    username: "bo",
    $where: "sleep(5000)",
    nested: { $ne: null, keep: "yes" },
    list: [{ $gt: "" }, { fine: 1 }],
    // A message that mentions money is a message, not an attack.
    text: "$20 for the collar",
  };

  const removed = scrub(payload);

  assert.equal(removed, 3);
  assert.deepEqual(payload, {
    username: "bo",
    nested: { keep: "yes" },
    list: [{}, { fine: 1 }],
    text: "$20 for the collar",
  });
});

test("scrub cannot be driven into a stack overflow", () => {
  const deep = {};
  let node = deep;
  for (let i = 0; i < 5000; i += 1) {
    node.next = {};
    node = node.next;
  }

  assert.doesNotThrow(() => scrub(deep));
});

test("an operator in a query string does not become a filter", async () => {
  await makeUser("searcher");
  await makeUser("target");

  // `?q[$ne]=` is the classic shape: with the extended parser it arrives as an
  // object, and a query built from it matches every row instead of one.
  const response = await request(app)
    .get("/api/users?q[$ne]=")
    .set(...auth("searcher"));

  assert.notEqual(response.status, 500);
  if (Array.isArray(response.body)) {
    assert.equal(response.body.length, 0, "an operator must not match everybody");
  }
});

test("an operator in a body is dropped before it reaches Mongoose", async () => {
  await makeUser("writer");

  const response = await request(app)
    .post("/api/users")
    .set(...auth("writer"))
    .send({ username: "writer2", $set: { suspended: false } });

  assert.notEqual(response.status, 500);
  const stored = await User.findOne({ firebaseUid: "writer" }).lean();
  assert.ok(!Object.hasOwn(stored, "$set"));
});

// ---------------------------------------------------------------------------
// Malformed ids
// ---------------------------------------------------------------------------

test("a malformed id is a 404, not a 500", async () => {
  await makeUser("curious");

  const response = await request(app)
    .get("/api/pets/not-an-object-id")
    .set(...auth("curious"));

  // A CastError used to reach the default handler as a 500 with a stack in the
  // log, so probing an endpoint with junk looked like a real outage and buried
  // the real ones.
  assert.equal(response.status, 404);
  // Mongoose's own wording names the model and the schema path: "Cast to
  // ObjectId failed ... at path \"_id\" for model \"Pet\"". A typo should not
  // return a map of the schema.
  const body = JSON.stringify(response.body);
  assert.ok(!body.includes("Cast to ObjectId"));
  assert.ok(!body.includes("model"));
});

test("a static path is not mistaken for an id and reported against a model", async () => {
  await makeUser("curious");

  // `/api/users/search` has no route, so it fell through to `GET /:id` and
  // answered with a cast failure against the User model.
  const response = await request(app)
    .get("/api/users/search")
    .set(...auth("curious"));

  assert.equal(response.status, 404);
  assert.ok(!JSON.stringify(response.body).includes("User"));
});

test("a real id still works", async () => {
  const user = await makeUser("owner");
  const pet = await Pet.create({
    name: "Bo",
    weight: 20,
    breed: "Beagle",
    age: 3,
    owner: user._id,
    creator: user._id,
  });

  await request(app)
    .get(`/api/pets/${pet._id}`)
    .set(...auth("owner"))
    .expect(200);
});

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

test("username checks are capped, so the endpoint is not an enumeration oracle", async () => {
  limits.setEnabled(true);
  await makeUser("prober");

  let limited = 0;
  for (let i = 0; i < 130; i += 1) {
    const response = await request(app)
      .get(`/api/users/username-available?username=name${i}`)
      .set(...auth("prober"));
    if (response.status === 429) limited += 1;
  }

  assert.ok(limited > 0, "walking a word list should meet a ceiling");
});

test("a limited response says so in the same shape as every other error", async () => {
  limits.setEnabled(true);
  await makeUser("prober");

  let body = null;
  for (let i = 0; i < 130 && !body; i += 1) {
    const response = await request(app)
      .get(`/api/users/username-available?username=n${i}`)
      .set(...auth("prober"));
    if (response.status === 429) body = response.body;
  }

  assert.equal(body.code, "RATE_LIMITED");
  assert.ok(typeof body.message === "string" && body.message.length > 0);
});

test("reads are not counted against the outreach limit", async () => {
  limits.setEnabled(true);
  await makeUser("reader");

  // Sitting on a chat screen polls; only what the app *sends* should count.
  for (let i = 0; i < 40; i += 1) {
    await request(app)
      .get("/api/chats")
      .set(...auth("reader"))
      .expect(200);
  }
});

test("the limit follows the account, not the address", async () => {
  await makeUser("housemate-a");
  await makeUser("housemate-b");

  const { byUserOrIp } = limits;
  const a = byUserOrIp({ userId: "aaa", ip: "203.0.113.4" });
  const b = byUserOrIp({ userId: "bbb", ip: "203.0.113.4" });

  // Two people behind one NAT are two clients. Keying on the address alone
  // would let either of them exhaust the other's allowance.
  assert.notEqual(a, b);
});

test("an IPv6 caller cannot sidestep a limit by changing address", () => {
  const { byUserOrIp } = limits;

  // A subscriber is typically handed a whole /64. Keying on the exact address
  // would give one person billions of buckets.
  const first = byUserOrIp({ ip: "2001:db8:1234:5678::1" });
  const second = byUserOrIp({ ip: "2001:db8:1234:5678::99ff" });

  assert.equal(first, second);
});

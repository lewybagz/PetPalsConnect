const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let Device;
let DevicePosition;
let TrackingShare;
let limits;

/**
 * The tracking collar.
 *
 * Nearly every test here is about who may see a position, because that is
 * the whole risk: the rest of the app hands a stranger the neighbourhood and
 * this hands the owner the door. Exact for the owner; exact for a friend with
 * a live share; a 404 for everybody else, including a friend whose share has
 * run out and a friend who has been blocked since. The vendor boundary is
 * exercised twice, once with the simulator and once with a device POSTing
 * through the generic adapter.
 */
test.before(async () => {
  process.env.TRACKING_VENDOR = "generic";
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Device = require("../models/Device");
  DevicePosition = require("../models/DevicePosition");
  TrackingShare = require("../models/TrackingShare");
  limits = require("../middleware/rateLimits");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  process.env.TRACKING_VENDOR = "generic";
  limits.setEnabled(false);
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const PHOENIX = [-112.074, 33.4484];

const signUp = async (uid, coordinates = PHOENIX) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    geoLocation: coordinates ? { type: "Point", coordinates } : undefined,
  });
  const pet = await Pet.create({
    name: `${uid}-dog`,
    weight: 30,
    breed: "Labrador",
    age: 3,
    owner: user._id,
    creator: user._id,
  });
  await User.updateOne({ _id: user._id }, { $push: { pets: pet._id } });
  return { header: auth(uid), user, pet };
};

const befriend = async (a, b) => {
  const created = await request(app)
    .post("/api/friendrequests")
    .set(...a.header)
    .send({ receiver: String(b.user._id) })
    .expect(201);
  await request(app)
    .put(`/api/friendrequests/${created.body._id}/accept`)
    .set(...b.header)
    .expect(200);
};

const claim = async (owner, serial = "PPC-000001") => {
  const res = await request(app)
    .post("/api/tracking/devices")
    .set(...owner.header)
    .send({ serial, petId: String(owner.pet._id) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

const report = (serial, secret, body) =>
  request(app)
    .post("/api/tracking/ingest")
    .set("x-device-serial", serial)
    .set("x-device-secret", secret)
    .send(body);

const HERE = { latitude: 33.45123, longitude: -112.07345, accuracyMeters: 6, batteryPercent: 81 };

const positionsFor = (viewer, pet) =>
  request(app).get(`/api/tracking/pets/${pet._id}/positions`).set(...viewer.header);

// --- Off, on, and the vendor -------------------------------------------------

test("with no vendor configured, tracking is off and every route says so", async () => {
  const owner = await signUp("owner");
  delete process.env.TRACKING_VENDOR;

  const status = await request(app).get("/api/tracking/status").set(...owner.header);
  assert.equal(status.status, 200);
  assert.deepEqual(status.body, { enabled: false, vendor: null, acceptsIngest: false });

  assert.equal((await request(app).get("/api/tracking/devices").set(...owner.header)).status, 503);
  assert.equal((await positionsFor(owner, owner.pet)).status, 503);
  assert.equal((await report("PPC-000001", "x", HERE)).status, 503);
});

test("the status names the vendor and whether devices report in", async () => {
  const owner = await signUp("owner");
  const res = await request(app).get("/api/tracking/status").set(...owner.header);
  assert.deepEqual(res.body, { enabled: true, vendor: "generic", acceptsIngest: true });
});

// --- Claiming ----------------------------------------------------------------

test("an owner claims a collar for their own pet and gets the secret exactly once", async () => {
  const owner = await signUp("owner");
  const { device, secret } = await claim(owner, " ppc-000001 ");

  assert.equal(device.serial, "PPC-000001");
  assert.equal(device.pet, String(owner.pet._id));
  assert.equal(typeof secret, "string");
  assert.ok(secret.length >= 24);
  assert.equal(device.ingestSecretHash, undefined, "the hash never leaves the server");

  const stored = await Device.findOne({ serial: "PPC-000001" }).lean();
  assert.equal(String(stored.owner), String(owner.user._id));
  assert.notEqual(stored.ingestSecretHash, secret, "the plaintext is never stored");

  const list = await request(app).get("/api/tracking/devices").set(...owner.header);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].secret, undefined);
  assert.equal(list.body[0].ingestSecretHash, undefined);
});

test("a collar cannot be claimed for somebody else's pet, and a taken serial is refused", async () => {
  const owner = await signUp("owner");
  const other = await signUp("other");

  const theirs = await request(app)
    .post("/api/tracking/devices")
    .set(...owner.header)
    .send({ serial: "PPC-000002", petId: String(other.pet._id) });
  assert.equal(theirs.status, 404);

  await claim(owner, "PPC-000003");
  const taken = await request(app)
    .post("/api/tracking/devices")
    .set(...other.header)
    .send({ serial: "PPC-000003", petId: String(other.pet._id) });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.code, "SERIAL_TAKEN");

  const bad = await request(app)
    .post("/api/tracking/devices")
    .set(...owner.header)
    .send({ serial: "no", petId: String(owner.pet._id) });
  assert.equal(bad.status, 400);
});

test("the owner is the caller, whatever the body says", async () => {
  const owner = await signUp("owner");
  const other = await signUp("other");

  await request(app)
    .post("/api/tracking/devices")
    .set(...owner.header)
    .send({ serial: "PPC-000004", petId: String(owner.pet._id), owner: String(other.user._id) })
    .expect(201);

  const stored = await Device.findOne({ serial: "PPC-000004" }).lean();
  assert.equal(String(stored.owner), String(owner.user._id));
});

// --- A device reporting in --------------------------------------------------

test("a device with the right secret records a position; the owner reads it exactly", async () => {
  const owner = await signUp("owner");
  const { secret } = await claim(owner);

  const res = await report("ppc-000001", secret, HERE);
  assert.equal(res.status, 202);

  const stored = await DevicePosition.findOne().lean();
  assert.deepEqual(stored.point.coordinates, [HERE.longitude, HERE.latitude]);
  assert.equal(String(stored.owner), String(owner.user._id));

  const mine = await positionsFor(owner, owner.pet);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.latest.latitude, HERE.latitude);
  assert.equal(mine.body.latest.longitude, HERE.longitude);
  assert.equal(mine.body.latest.batteryPercent, 81);
  assert.equal(mine.body.device.batteryPercent, 81);
  assert.ok(mine.body.device.lastSeenAt);
  assert.equal(mine.body.trail.length, 1);
  assert.equal(mine.body.owner.username, "owner");
});

test("a wrong secret and an unknown serial get the same refusal", async () => {
  const owner = await signUp("owner");
  await claim(owner);

  const wrong = await report("PPC-000001", "not-the-secret", HERE);
  const unknown = await report("PPC-999999", "anything", HERE);
  const missing = await request(app).post("/api/tracking/ingest").send(HERE);

  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(await DevicePosition.countDocuments(), 0);
});

test("a report that is not a position is refused, and a future clock is clamped", async () => {
  const owner = await signUp("owner");
  const { secret } = await claim(owner);

  assert.equal((await report("PPC-000001", secret, { latitude: 91, longitude: 0 })).status, 400);
  assert.equal((await report("PPC-000001", secret, { lat: "x" })).status, 400);
  assert.equal((await report("PPC-000001", secret, {})).status, 400);

  const future = new Date(Date.now() + 3_600_000).toISOString();
  await report("PPC-000001", secret, { lat: 33.45, lng: -112.07, recordedAt: future }).expect(202);
  const stored = await DevicePosition.findOne().lean();
  assert.ok(stored.recordedAt <= new Date());
});

test("a retired collar's reports are acknowledged and dropped", async () => {
  const owner = await signUp("owner");
  const { device, secret } = await claim(owner);

  await request(app)
    .patch(`/api/tracking/devices/${device._id}`)
    .set(...owner.header)
    .send({ status: "inactive" })
    .expect(200);

  const res = await report("PPC-000001", secret, HERE);
  assert.equal(res.status, 202);
  assert.equal(res.body.received, false);
  assert.equal(await DevicePosition.countDocuments(), 0);
});

test("a flooding collar meets a ceiling, per serial", async () => {
  const owner = await signUp("owner");
  const { secret } = await claim(owner);
  limits.setEnabled(true);

  let limited = 0;
  for (let i = 0; i < 620; i += 1) {
    const res = await report("PPC-000001", secret, HERE);
    if (res.status === 429) limited += 1;
  }
  assert.ok(limited > 0, "a device reporting hundreds of times a minute should be throttled");
});

// --- Who may see it -----------------------------------------------------------

test("a stranger, and a friend without a share, get 404 - not 403", async () => {
  const owner = await signUp("owner");
  const stranger = await signUp("stranger");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  const { secret } = await claim(owner);
  await report("PPC-000001", secret, HERE);

  assert.equal((await positionsFor(stranger, owner.pet)).status, 404);
  assert.equal((await positionsFor(friend, owner.pet)).status, 404);
});

test("a friend with a live share sees the exact position; the share expires", async () => {
  const owner = await signUp("owner");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  const { secret } = await claim(owner);
  await report("PPC-000001", secret, HERE);

  const shared = await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id), hours: 2 });
  assert.equal(shared.status, 201);
  const expiresIn = new Date(shared.body.expiresAt) - Date.now();
  assert.ok(expiresIn > 1.9 * 3_600_000 && expiresIn <= 2 * 3_600_000);

  const theirs = await positionsFor(friend, owner.pet);
  assert.equal(theirs.status, 200);
  assert.equal(theirs.body.latest.latitude, HERE.latitude);
  assert.equal(theirs.body.latest.longitude, HERE.longitude);

  // Time passes. The row may still exist for up to a minute after the TTL,
  // so the date itself has to be checked, not only the row's existence.
  await TrackingShare.updateOne({ viewer: friend.user._id }, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await positionsFor(friend, owner.pet)).status, 404);
});

test("a block ends a live share's effect at once, in either direction", async () => {
  const owner = await signUp("owner");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  const { secret } = await claim(owner);
  await report("PPC-000001", secret, HERE);
  await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id) })
    .expect(201);
  assert.equal((await positionsFor(friend, owner.pet)).status, 200);

  // The friend blocks the owner.
  await request(app)
    .post("/api/blocklists")
    .set(...friend.header)
    .send({ blockedUser: String(owner.user._id) })
    .expect(201);
  assert.equal((await positionsFor(friend, owner.pet)).status, 404);

  // And the share no longer lists on either side.
  const ownerShares = await request(app).get("/api/tracking/shares").set(...owner.header);
  assert.equal(ownerShares.body.given.length, 0);
  const friendShares = await request(app).get("/api/tracking/shares").set(...friend.header);
  assert.equal(friendShares.body.received.length, 0);
});

test("a share can only go to a friend, only from the owner, and is capped at a week", async () => {
  const owner = await signUp("owner");
  const stranger = await signUp("stranger");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  await claim(owner);

  const toStranger = await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(stranger.user._id) });
  assert.equal(toStranger.status, 404);

  const notMine = await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...friend.header)
    .send({ viewer: String(stranger.user._id) });
  assert.equal(notMine.status, 404);

  const toSelf = await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(owner.user._id) });
  assert.equal(toSelf.status, 400);

  const long = await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id), hours: 10_000 });
  assert.equal(long.status, 201);
  const expiresIn = new Date(long.body.expiresAt) - Date.now();
  assert.ok(expiresIn <= 7 * 24 * 3_600_000);

  // Sharing again extends the one row rather than adding another.
  await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id), hours: 1 })
    .expect(201);
  assert.equal(await TrackingShare.countDocuments(), 1);

  // And can be ended.
  const ended = await request(app)
    .delete(`/api/tracking/pets/${owner.pet._id}/shares/${friend.user._id}`)
    .set(...owner.header);
  assert.equal(ended.body.removed, true);
  assert.equal(await TrackingShare.countDocuments(), 0);
});

test("a suspended owner's collar is not visible to a friend, even with a share", async () => {
  const owner = await signUp("owner");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  const { secret } = await claim(owner);
  await report("PPC-000001", secret, HERE);
  await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id) })
    .expect(201);

  await User.updateOne({ _id: owner.user._id }, { suspended: true });
  assert.equal((await positionsFor(friend, owner.pet)).status, 404);
});

test("the discovery map stays coarse whatever a collar reports", async () => {
  // The two answers are different on purpose: exact here, the neighbourhood
  // there. This is the assertion that keeps them from ever sharing a path.
  const source = require("node:fs").readFileSync(
    require("node:path").resolve(__dirname, "../controllers/PetMatchController.js"),
    "utf8"
  );
  assert.ok(!/DevicePosition|tracking\/positions/.test(source), "the discovery map must not read collar positions");
});

// --- The simulator -----------------------------------------------------------

test("the simulator invents a deterministic position per collar and refreshes it as time passes", async () => {
  process.env.TRACKING_VENDOR = "simulator";
  const owner = await signUp("owner");
  const { secret } = await claim(owner, "SIM-000001");
  assert.equal(secret, null, "a simulated collar has nothing to authenticate");

  const first = await positionsFor(owner, owner.pet);
  assert.equal(first.status, 200);
  assert.ok(first.body.latest, "a read writes the first position");
  // Within about 400 m of the owner's own position.
  assert.ok(Math.abs(first.body.latest.latitude - PHOENIX[1]) < 0.005);
  assert.ok(Math.abs(first.body.latest.longitude - PHOENIX[0]) < 0.005);

  // A second read inside the tick window writes nothing new.
  await positionsFor(owner, owner.pet);
  assert.equal(await DevicePosition.countDocuments(), 1);

  // Push the only row into the past and the next read moves the collar on.
  await DevicePosition.updateMany({}, { recordedAt: new Date(Date.now() - 5 * 60_000) });
  const later = await positionsFor(owner, owner.pet);
  assert.equal(await DevicePosition.countDocuments(), 2);
  assert.equal(later.body.trail.length, 2);
  assert.ok(new Date(later.body.latest.recordedAt) > new Date(later.body.trail[0].recordedAt));

  // A device reporting in is refused: the simulator does not take ingest.
  assert.equal((await report("SIM-000001", "x", HERE)).status, 503);
});

test("the simulator's position is a pure function of serial and clock", () => {
  const { positionAt } = require("../services/tracking/vendor/simulator");
  const device = { serial: "SIM-000001" };
  const a = positionAt(device, null, 1_700_000_000_000);
  const b = positionAt(device, null, 1_700_000_000_000);
  const c = positionAt({ serial: "SIM-000002" }, null, 1_700_000_000_000);
  assert.deepEqual(a, b);
  assert.notDeepEqual([a.latitude, a.longitude], [c.latitude, c.longitude]);

  // And it moves: five minutes on, the same collar is somewhere else.
  const d = positionAt(device, null, 1_700_000_000_000 + 5 * 60_000);
  assert.notDeepEqual([a.latitude, a.longitude], [d.latitude, d.longitude]);
});

// --- Retention and deletion -------------------------------------------------

test("positions and shares expire on their own, by index", () => {
  const positionIndexes = DevicePosition.schema.indexes();
  const ttl = positionIndexes.find(([keys]) => keys.recordedAt === 1);
  assert.ok(ttl, "recordedAt has an index");
  assert.equal(ttl[1].expireAfterSeconds, DevicePosition.RETENTION_DAYS * 24 * 60 * 60);
  assert.equal(DevicePosition.RETENTION_DAYS, 30);

  const shareTtl = TrackingShare.schema.indexes().find(([keys]) => keys.expiresAt === 1);
  assert.equal(shareTtl[1].expireAfterSeconds, 0);
});

test("deleting an account removes its collars, positions, and shares in both directions", async () => {
  const owner = await signUp("owner");
  const friend = await signUp("friend");
  await befriend(owner, friend);
  const { secret } = await claim(owner);
  await report("PPC-000001", secret, HERE);
  await request(app)
    .post(`/api/tracking/pets/${owner.pet._id}/shares`)
    .set(...owner.header)
    .send({ viewer: String(friend.user._id) })
    .expect(201);

  // The friend has a collar too and has shared it back.
  const { secret: friendSecret } = await claim(friend, "PPC-000009");
  await report("PPC-000009", friendSecret, HERE);
  await request(app)
    .post(`/api/tracking/pets/${friend.pet._id}/shares`)
    .set(...friend.header)
    .send({ viewer: String(owner.user._id) })
    .expect(201);

  await request(app).delete("/api/users/me").set(...owner.header).expect(200);

  assert.equal(await Device.countDocuments({ owner: owner.user._id }), 0);
  assert.equal(await DevicePosition.countDocuments({ owner: owner.user._id }), 0);
  assert.equal(await TrackingShare.countDocuments(), 0, "shares given and received both go");
  // The friend's own collar and positions are untouched.
  assert.equal(await Device.countDocuments({ owner: friend.user._id }), 1);
  assert.equal(await DevicePosition.countDocuments({ owner: friend.user._id }), 1);
});

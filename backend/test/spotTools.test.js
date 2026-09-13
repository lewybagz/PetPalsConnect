const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let User;
let Pet;
let WeightEntry;
let HealthRecord;
let ScheduledJob;
let toolsFor;
let WRITE_TOOLS;
let blocksFrom;

/**
 * Spot's tools, called directly, with two accounts and an outsider.
 *
 * The static auth audit scans controllers and cannot see this file, so the
 * scoping is proven behaviourally: every read answers only the caller's own
 * rows, and every write tool refuses a pet the caller does not own and
 * writes nothing. `WRITE_TOOLS` is iterated rather than listed by hand, so a
 * write tool added without a case here fails this file rather than shipping.
 */
test.before(async () => {
  await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  WeightEntry = require("../models/WeightEntry");
  HealthRecord = require("../models/HealthRecord");
  ScheduledJob = require("../models/ScheduledJob");
  ({ toolsFor, WRITE_TOOLS } = require("../services/spot/tools"));
  ({ blocksFrom } = require("../services/spot/blocks"));
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const makeOwner = async (uid, petFields = {}) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pet = await Pet.create({
    name: `${uid}-dog`,
    species: "dog",
    breed: "Beagle",
    weight: 20,
    age: 3,
    temperament: "Friendly",
    owner: user._id,
    creator: user._id,
    ...petFields,
  });
  await User.findByIdAndUpdate(user._id, { $push: { pets: pet._id } });
  return { user, pet };
};

/** Calls one tool by name and parses its JSON result. */
const call = async (toolset, name, input = {}) => {
  const tool = toolset.tools.find((t) => t.name === name);
  assert.ok(tool, `no tool named ${name}`);
  return JSON.parse(await tool.run(input));
};

const names = (toolset) => toolset.tools.map((t) => t.name);

// ---------------------------------------------------------------------------
// Reads are the caller's own
// ---------------------------------------------------------------------------

test("my_pets lists the caller's pets and nobody else's", async () => {
  const alice = await makeOwner("alice");
  await makeOwner("bob");

  const result = await call(toolsFor({ userId: alice.user._id }), "my_pets");
  assert.deepEqual(
    result.pets.map((pet) => pet.petId),
    [String(alice.pet._id)]
  );
  assert.equal(result.pets[0].vaccinationStatus, "unknown");
  assert.equal(result.pets[0].weightPounds, 20);
});

test("pet_health_records refuses somebody else's pet", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  await HealthRecord.create({
    pet: alice.pet._id,
    owner: alice.user._id,
    creator: alice.user._id,
    kind: "rabies",
    administeredAt: new Date(),
  });

  const mine = await call(toolsFor({ userId: alice.user._id }), "pet_health_records", {
    petId: String(alice.pet._id),
  });
  assert.equal(mine.records.length, 1);
  assert.equal(mine.records[0].kind, "rabies");

  const theirs = await call(toolsFor({ userId: bob.user._id }), "pet_health_records", {
    petId: String(alice.pet._id),
  });
  assert.ok(theirs.error, "an outsider gets an error, not records");
  assert.equal(theirs.records, undefined);
});

test("care_places_nearby says plainly when no position is known", async () => {
  const alice = await makeOwner("alice");
  const result = await call(toolsFor({ userId: alice.user._id }), "care_places_nearby");
  assert.equal(result.locationKnown, false);
  assert.deepEqual(result.places, []);
});

test("a toxin lookup records the effect that attaches the helpline numbers", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const hit = await call(toolset, "toxin_lookup", { query: "grapes", species: "dog" });
  assert.ok(hit.matches.length > 0);
  assert.ok(["emergency", "call", "avoid"].includes(hit.matches[0].severity));
  assert.equal(JSON.stringify(hit).includes("mg/kg"), false);

  const miss = await call(toolset, "toxin_lookup", { query: "zzz-not-a-thing" });
  assert.deepEqual(miss.matches, []);
  assert.ok(miss.contacts.length > 0, "a miss still carries the numbers");

  const blocks = blocksFrom(toolset.effects);
  assert.equal(blocks.filter((block) => block.type === "contacts").length, 1);
});

test("open_screen offers a chip only for a screen with the param it needs", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const ok = await call(toolset, "open_screen", { screen: "PetHealth", value: String(alice.pet._id) });
  assert.equal(ok.offered.screen, "PetHealth");
  const bad = await call(toolset, "open_screen", { screen: "PetHealth" });
  assert.ok(bad.error);

  const links = blocksFrom(toolset.effects).find((block) => block.type === "links");
  assert.equal(links.items.length, 1);
});

// ---------------------------------------------------------------------------
// Writes go through the one writer, and only for the caller's own pet
// ---------------------------------------------------------------------------

test("log_weight moves Pet.weight exactly as the endpoint does, and offers the undo", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const result = await call(toolset, "log_weight", { petId: String(alice.pet._id), pounds: 26 });
  assert.equal(result.pounds, 26);

  const updated = await Pet.findById(alice.pet._id).select("weight").lean();
  assert.equal(updated.weight, 26, "Pet.weight follows the newest weigh-in");

  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.equal(done.kind, "logWeight");
  assert.equal(done.undo.kind, "removeWeight");
  assert.equal(done.undo.entryId, result.entryId);

  // And the undo does what it says.
  await call(toolset, "remove_weight", { petId: String(alice.pet._id), entryId: result.entryId });
  assert.equal(await WeightEntry.countDocuments({ pet: alice.pet._id }), 0);
});

test("add_health_record queues the reminder the endpoint would, and mark_record_done writes the next one", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const vaccine = await call(toolset, "add_health_record", {
    petId: String(alice.pet._id),
    kind: "rabies",
    administeredAt: "2026-01-10",
    expiresAt: "2029-01-10",
  });
  assert.ok(vaccine.recordId);
  assert.equal(await ScheduledJob.countDocuments({ type: "vaccination:due" }), 1);

  const notRepeating = await call(toolset, "mark_record_done", {
    petId: String(alice.pet._id),
    recordId: vaccine.recordId,
  });
  assert.ok(notRepeating.error, "a vaccine has no cycle");

  const flea = await call(toolset, "add_health_record", {
    petId: String(alice.pet._id),
    kind: "fleaTick",
    administeredAt: "2026-08-01",
    intervalDays: 30,
  });
  const next = await call(toolset, "mark_record_done", {
    petId: String(alice.pet._id),
    recordId: flea.recordId,
  });
  assert.ok(next.nextRecordId);
  assert.equal(await HealthRecord.countDocuments({ pet: alice.pet._id, kind: "fleaTick" }), 2);
});

test("update_setting validates through the settings schema and refuses Spot's own toggle", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const ok = await call(toolset, "update_setting", { patch: { units: { weight: "kg" } } });
  assert.deepEqual(ok.updated, { "units.weight": "kg" });
  const user = await User.findById(alice.user._id).select("units").lean();
  assert.equal(user.units.weight, "kg");

  const bad = await call(toolset, "update_setting", { patch: { units: { weight: "stone" } } });
  assert.ok(bad.error);

  const consent = await call(toolset, "update_setting", { patch: { spot: { readChats: true } } });
  assert.ok(consent.error);
  const after = await User.findById(alice.user._id).select("spot").lean();
  assert.equal(after.spot.readChats, false);

  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.deepEqual(done.undo, { kind: "updateSetting", set: { "units.weight": "lb" } });
});

test("every write tool refuses another owner's pet and writes nothing", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const entry = await WeightEntry.create({
    pet: alice.pet._id,
    owner: alice.user._id,
    creator: alice.user._id,
    pounds: 21,
    takenAt: new Date(),
  });
  const record = await HealthRecord.create({
    pet: alice.pet._id,
    owner: alice.user._id,
    creator: alice.user._id,
    kind: "fleaTick",
    administeredAt: new Date(),
    intervalDays: 30,
  });

  const inputs = {
    log_weight: { petId: String(alice.pet._id), pounds: 30 },
    remove_weight: { petId: String(alice.pet._id), entryId: String(entry._id) },
    add_health_record: { petId: String(alice.pet._id), kind: "rabies", administeredAt: "2026-01-01" },
    mark_record_done: { petId: String(alice.pet._id), recordId: String(record._id) },
    remove_health_record: { petId: String(alice.pet._id), recordId: String(record._id) },
    // Settings are the caller's own row; the "other owner" case is that the
    // write lands on Bob and never on Alice.
    update_setting: { patch: { units: { distance: "km" } } },
  };

  const untested = WRITE_TOOLS.filter((name) => !inputs[name]);
  assert.deepEqual(untested, [], `write tools with no two-account case: ${untested.join(", ")}`);

  const asBob = toolsFor({ userId: bob.user._id });
  for (const name of WRITE_TOOLS) {
    const result = await call(asBob, name, inputs[name]);
    if (name !== "update_setting") {
      assert.ok(result.error, `${name} should refuse another owner's pet`);
    }
  }

  const pet = await Pet.findById(alice.pet._id).select("weight").lean();
  assert.equal(pet.weight, 20, "Alice's pet is untouched");
  assert.equal(await WeightEntry.countDocuments({ pet: alice.pet._id }), 1);
  assert.equal(await HealthRecord.countDocuments({ pet: alice.pet._id }), 1);
  const alice2 = await User.findById(alice.user._id).select("units").lean();
  assert.equal(alice2.units.distance, "mi");
  const bob2 = await User.findById(bob.user._id).select("units").lean();
  assert.equal(bob2.units.distance, "km");
  assert.equal(blocksFrom(asBob.effects).filter((b) => b.type === "done").length, 1, "only Bob's own setting change is a done block");
});

// ---------------------------------------------------------------------------
// The chats tool exists only when the owner said so
// ---------------------------------------------------------------------------

test("my_chats is not in the tool list until readChats is on", async () => {
  const alice = await makeOwner("alice");
  assert.equal(names(toolsFor({ userId: alice.user._id })).includes("my_chats"), false);
  assert.equal(names(toolsFor({ userId: alice.user._id, readChats: true })).includes("my_chats"), true);
});

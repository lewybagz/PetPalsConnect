const test = require("node:test");
const assert = require("node:assert/strict");

const harness = require("./helpers/harness");

let User;
let Pet;
let WeightEntry;
let HealthRecord;
let ScheduledJob;
let Playdate;
let Location;
let Friend;
let PetMatch;
let Favorite;
let Notification;
let SupportMessage;
let blocking;
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
  Playdate = require("../models/Playdate");
  Location = require("../models/Location");
  Friend = require("../models/Friend");
  PetMatch = require("../models/PetMatch");
  Favorite = require("../models/Favorite");
  Notification = require("../models/Notification");
  SupportMessage = require("../models/SupportMessage");
  blocking = require("../services/blocking");
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

const DAY = 24 * 60 * 60 * 1000;

let parkSeq = 0;
const makePark = () =>
  Location.create({
    name: `Park ${(parkSeq += 1)}`,
    address: "1 Park Lane",
    placeId: `spot-park-${parkSeq}`,
    geoLocation: { type: "Point", coordinates: [-112.07, 33.45] },
  });

/** A pending playdate `organiser` set up with `invitee`. */
const makePlaydate = async (organiser, invitee, fields = {}) =>
  Playdate.create({
    date: new Date(Date.now() + DAY),
    startTime: new Date(Date.now() + DAY),
    location: (await makePark())._id,
    participants: [organiser.user._id, invitee.user._id],
    petsInvolved: [organiser.pet._id, invitee.pet._id],
    status: "pending",
    creator: organiser.user._id,
    ...fields,
  });

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

  const carol = await makeOwner("carol");
  const playdate = await makePlaydate(carol, alice);
  await User.updateOne({ _id: alice.user._id }, { $push: { spotNotes: { text: "alice's note" } } });
  const aliceNote = (await User.findById(alice.user._id).select("spotNotes").lean()).spotNotes[0];
  const aliceReminder = await require("../services/spot/reminders").create({
    ownerId: alice.user._id,
    text: "alice's reminder",
    at: new Date(Date.now() + 86400000).toISOString(),
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
    // Bob is not on Alice and Carol's playdate.
    respond_to_playdate: { playdateId: String(playdate._id), decision: "accept" },
    cancel_playdate: { playdateId: String(playdate._id), reason: "rain" },
    update_pet: { petId: String(alice.pet._id), breed: "Whippet" },
    forget: { noteId: String(aliceNote._id) },
    // These three are the caller's own row, like update_setting.
    add_pet: { name: "Bob's cat", species: "cat", ageYears: 2, breed: "Tabby", weightPounds: 9 },
    remember: { text: "bob's note" },
    contact_support: { message: "help from bob" },
    remind_me: { text: "bob's reminder", at: new Date(Date.now() + 86400000).toISOString() },
    cancel_reminder: { reminderId: String(aliceReminder.reminderId) },
  };
  const OWN_ROW = new Set(["update_setting", "add_pet", "remember", "contact_support", "remind_me"]);

  const untested = WRITE_TOOLS.filter((name) => !inputs[name]);
  assert.deepEqual(untested, [], `write tools with no two-account case: ${untested.join(", ")}`);

  const asBob = toolsFor({ userId: bob.user._id });
  for (const name of WRITE_TOOLS) {
    const result = await call(asBob, name, inputs[name]);
    if (!OWN_ROW.has(name)) {
      assert.ok(result.error, `${name} should refuse another owner's row`);
    }
  }

  const untouched = await Playdate.findById(playdate._id).lean();
  assert.equal(untouched.status, "pending");
  assert.equal((await Pet.findById(alice.pet._id).lean()).breed, "Beagle");
  const aliceAfter = await User.findById(alice.user._id).select("spotNotes pets").lean();
  assert.equal(aliceAfter.spotNotes.length, 1);
  assert.equal(aliceAfter.pets.length, 1);
  const ScheduledJob = require("../models/ScheduledJob");
  assert.equal((await ScheduledJob.findById(aliceReminder.reminderId).lean()).status, "pending", "Alice's reminder stands");
  assert.equal(await ScheduledJob.countDocuments({ "payload.owner": String(bob.user._id), status: "pending" }), 1, "Bob's reminder is Bob's");
  const bobAfter = await User.findById(bob.user._id).select("spotNotes pets").lean();
  assert.deepEqual(bobAfter.spotNotes.map((note) => note.text), ["bob's note"]);
  assert.equal(bobAfter.pets.length, 2, "Bob's new cat is Bob's");
  assert.equal(await SupportMessage.countDocuments({ email: "bob@example.test" }), 1);
  assert.equal(await SupportMessage.countDocuments({ email: "alice@example.test" }), 0);

  const pet = await Pet.findById(alice.pet._id).select("weight").lean();
  assert.equal(pet.weight, 20, "Alice's pet is untouched");
  assert.equal(await WeightEntry.countDocuments({ pet: alice.pet._id }), 1);
  assert.equal(await HealthRecord.countDocuments({ pet: alice.pet._id }), 1);
  const alice2 = await User.findById(alice.user._id).select("units").lean();
  assert.equal(alice2.units.distance, "mi");
  const bob2 = await User.findById(bob.user._id).select("units").lean();
  assert.equal(bob2.units.distance, "km");
  assert.equal(
    blocksFrom(asBob.effects).filter((b) => b.type === "done").length,
    OWN_ROW.size,
    "only Bob's own writes are done blocks"
  );
});

// ---------------------------------------------------------------------------
// The chats tool exists only when the owner said so
// ---------------------------------------------------------------------------

test("my_chats is not in the tool list until readChats is on", async () => {
  const alice = await makeOwner("alice");
  assert.equal(names(toolsFor({ userId: alice.user._id })).includes("my_chats"), false);
  assert.equal(names(toolsFor({ userId: alice.user._id, readChats: true })).includes("my_chats"), true);
});

// ---------------------------------------------------------------------------
// Phase 4 reads
// ---------------------------------------------------------------------------

test("weight_history describes the change over 30 and 90 days, and only for your own pet", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const at = (daysAgo, pounds) =>
    WeightEntry.create({ pet: alice.pet._id, owner: alice.user._id, creator: alice.user._id, pounds, takenAt: new Date(Date.now() - daysAgo * DAY) });
  await at(100, 20);
  await at(40, 24);
  await at(0, 26);

  const result = await call(toolsFor({ userId: alice.user._id }), "weight_history", { petId: String(alice.pet._id) });
  assert.deepEqual(result.entries.map((entry) => entry.pounds), [26, 24, 20]);
  assert.equal(result.change30Days, 2);
  assert.equal(result.change90Days, 6);

  const theirs = await call(toolsFor({ userId: bob.user._id }), "weight_history", { petId: String(alice.pet._id) });
  assert.ok(theirs.error);
});

test("my_pals and my_matches name the other pet and owner, and a block removes them", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const carol = await makeOwner("carol");
  await Friend.create({
    status: true,
    user1: alice.user._id,
    user2: bob.user._id,
    pet1: alice.pet._id,
    pet2: bob.pet._id,
    creator: alice.user._id,
  });
  await PetMatch.create({
    matchScore: 0.8,
    pet1: alice.pet._id,
    pet2: carol.pet._id,
    relevantToUser: alice.user._id,
    creator: alice.user._id,
  });
  // A match that is somebody else's must not show.
  await PetMatch.create({
    matchScore: 0.9,
    pet1: bob.pet._id,
    pet2: alice.pet._id,
    relevantToUser: bob.user._id,
    creator: bob.user._id,
  });

  const toolset = toolsFor({ userId: alice.user._id });
  const pals = await call(toolset, "my_pals");
  assert.deepEqual(pals.pals, [
    { username: "bob", petId: String(bob.pet._id), petName: "bob-dog", breed: "Beagle", species: "dog" },
  ]);
  const matches = await call(toolset, "my_matches");
  assert.deepEqual(matches.matches, [
    { petId: String(carol.pet._id), petName: "carol-dog", breed: "Beagle", species: "dog", username: "carol" },
  ]);

  await blocking.block({ ownerId: alice.user._id, blockedUserId: carol.user._id });
  assert.deepEqual((await call(toolset, "my_matches")).matches, []);
});

test("my_saved_places, whats_new and care_picks are the caller's own", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob", { specialNeeds: "diabetic" });
  const park = await makePark();
  await Favorite.create({ user: alice.user._id, location: park._id, creator: alice.user._id });
  await Notification.create({ content: "Rex wants a playdate", recipient: alice.user._id, type: "playdate" });
  await Notification.create({ content: "sam accepted", recipient: alice.user._id, type: "friendAccepted" });
  await Notification.create({ content: "old", recipient: alice.user._id, type: "message", readStatus: true });
  await Notification.create({ content: "not yours", recipient: bob.user._id, type: "playdate" });

  const toolset = toolsFor({ userId: alice.user._id });
  const saved = await call(toolset, "my_saved_places");
  assert.deepEqual(saved.places.map((place) => place.name), [park.name]);

  const unread = await call(toolset, "whats_new");
  assert.deepEqual(unread.unread.map((item) => item.kind).sort(), ["friendAccepted", "playdate"]);
  const playdate = unread.unread.find((item) => item.kind === "playdate");
  assert.equal(playdate.screen, "PlaydateDetails", "named, though a row carries no id to open it with");
  // Only a screen that needs no id becomes a chip; the rest are named for the model.
  const links = blocksFrom(toolset.effects).find((block) => block.type === "links");
  const screens = links.items.map((chip) => chip.screen);
  assert.ok(screens.includes("FriendsList"));
  assert.ok(!screens.includes("PlaydateDetails"));

  const picks = await call(toolset, "care_picks", { petId: String(alice.pet._id) });
  assert.equal(picks.seeAVet, false);
  assert.ok(picks.shelves.length > 0);
  const web = blocksFrom(toolset.effects).find((block) => block.type === "web");
  assert.ok(web.items.length > 0 && web.items.length <= 8);
  assert.ok(web.items.every((item) => item.url.startsWith("https://") && item.label));

  // A special-needs note means the vet shelf, exactly as the hub does it.
  const asBob = toolsFor({ userId: bob.user._id });
  const bobPicks = await call(asBob, "care_picks", { petId: String(bob.pet._id) });
  assert.equal(bobPicks.seeAVet, true);
  assert.deepEqual(bobPicks.shelves, []);
  assert.equal(blocksFrom(asBob.effects).find((block) => block.type === "web"), undefined);

  assert.ok((await call(asBob, "care_picks", { petId: String(alice.pet._id) })).error);
});

// ---------------------------------------------------------------------------
// Phase 4 writes
// ---------------------------------------------------------------------------

test("respond_to_playdate answers an invitation once, tells the organiser, and offers no undo", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const playdate = await makePlaydate(bob, alice);

  const toolset = toolsFor({ userId: alice.user._id });
  const result = await call(toolset, "respond_to_playdate", { playdateId: String(playdate._id), decision: "accept" });
  assert.equal(result.status, "accepted");
  assert.equal(result.notified, "@bob");
  assert.equal((await Playdate.findById(playdate._id).lean()).status, "accepted");
  assert.equal(await Notification.countDocuments({ recipient: bob.user._id, type: "playdateAccepted" }), 1);

  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.equal(done.kind, "respondToPlaydate");
  assert.equal(done.undo, null, "the organiser has been told; nothing to take back");
  assert.match(done.summary, /@bob has been told/);

  const again = await call(toolset, "respond_to_playdate", { playdateId: String(playdate._id), decision: "decline" });
  assert.match(again.error, /already accepted/);
  // The organiser cannot accept their own invitation through Spot either.
  const asBob = toolsFor({ userId: bob.user._id });
  assert.match((await call(asBob, "respond_to_playdate", { playdateId: String(playdate._id), decision: "accept" })).error, /organised/);
});

test("cancel_playdate is for people on it, and tells everyone else", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const carol = await makeOwner("carol");
  const playdate = await makePlaydate(bob, alice);

  assert.ok((await call(toolsFor({ userId: carol.user._id }), "cancel_playdate", { playdateId: String(playdate._id) })).error);
  assert.equal((await Playdate.findById(playdate._id).lean()).status, "pending");

  const toolset = toolsFor({ userId: alice.user._id });
  const result = await call(toolset, "cancel_playdate", { playdateId: String(playdate._id), reason: "rain" });
  assert.equal(result.status, "cancelled");
  const stored = await Playdate.findById(playdate._id).lean();
  assert.equal(stored.cancellationReason, "rain");
  assert.equal(await Notification.countDocuments({ recipient: bob.user._id, type: "playdateCancelled" }), 1);
  assert.equal(await Notification.countDocuments({ recipient: alice.user._id, type: "playdateCancelled" }), 0, "not told about your own cancellation");
  assert.equal(blocksFrom(toolset.effects).find((block) => block.type === "done").undo, null);
});

test("update_pet changes only what was passed and the undo carries the old values", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const result = await call(toolset, "update_pet", { petId: String(alice.pet._id), breed: "Whippet", ageYears: 5 });
  assert.deepEqual(result.updated, ["breed", "age"]);
  const pet = await Pet.findById(alice.pet._id).lean();
  assert.equal(pet.breed, "Whippet");
  assert.equal(pet.age, 5);
  assert.equal(pet.weight, 20, "untouched");

  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.deepEqual(done.undo, { kind: "restorePet", petId: String(alice.pet._id), set: { breed: "Beagle", age: 3 } });
  assert.ok((await call(toolset, "update_pet", { petId: String(alice.pet._id) })).error, "nothing to change");
  assert.ok((await call(toolset, "update_pet", { petId: String(alice.pet._id), activityLevel: "frantic" })).error, "the schema's enum holds");
});

test("add_pet lands on the profile through the onboarding path, and a dog needs a weight", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const refused = await call(toolset, "add_pet", { name: "Rex", species: "dog", ageYears: 2 });
  assert.match(refused.error, /needs a breed and a weight/);

  const result = await call(toolset, "add_pet", { name: "Miso", species: "cat", ageYears: 0, breed: "Tabby", weightPounds: 4.5 });
  assert.equal(result.name, "Miso");
  const owner = await User.findById(alice.user._id).select("pets").lean();
  assert.equal(owner.pets.length, 2);
  assert.ok(owner.pets.some((id) => String(id) === result.petId));
  const pet = await Pet.findById(result.petId).lean();
  assert.equal(String(pet.owner), String(alice.user._id));
  assert.equal(pet.species, "cat");

  const blocks = blocksFrom(toolset.effects);
  assert.equal(blocks.find((block) => block.type === "done").undo, null, "Spot never removes a pet");
  assert.ok(blocks.find((block) => block.type === "links").items.some((chip) => chip.label === "Open Miso"));

  // A bird needs no weight.
  assert.equal((await call(toolset, "add_pet", { name: "Kiwi", species: "bird", ageYears: 1 })).name, "Kiwi");
});

test("remember and forget keep a capped list in the owner's words, each undoing the other", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const kept = await call(toolset, "remember", { text: "  alice-dog is scared of thunderstorms  " });
  assert.equal(kept.notes, 1);
  const stored = await User.findById(alice.user._id).select("spotNotes").lean();
  assert.equal(stored.spotNotes[0].text, "alice-dog is scared of thunderstorms");
  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.deepEqual(done.undo, { kind: "forget", noteId: kept.noteId });

  for (let i = 1; i < 20; i += 1) await call(toolset, "remember", { text: `note ${i}` });
  assert.match((await call(toolset, "remember", { text: "one too many" })).error, /full \(20\)/);

  const forgot = await call(toolset, "forget", { noteId: kept.noteId });
  assert.equal(forgot.removed, true);
  const last = blocksFrom(toolset.effects).filter((block) => block.type === "done").at(-1);
  assert.deepEqual(last.undo, { kind: "remember", text: "alice-dog is scared of thunderstorms" });
  assert.ok((await call(toolset, "forget", { noteId: kept.noteId })).error, "gone is gone");
});

test("contact_support files a ticket under the caller's own name and email", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });
  const result = await call(toolset, "contact_support", { message: "The map is blank" });
  assert.equal(result.sent, true);
  const ticket = await SupportMessage.findOne({ email: "alice@example.test" }).lean();
  assert.equal(ticket.name, "alice");
  assert.equal(ticket.message, "The map is blank");
  assert.equal(blocksFrom(toolset.effects).find((block) => block.type === "done").undo, null);
});

test("plan_playdate prefills the form and sends nothing", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob");
  const park = await makePark();
  const toolset = toolsFor({ userId: alice.user._id });

  const result = await call(toolset, "plan_playdate", {
    theirPetId: String(bob.pet._id),
    myPetId: String(alice.pet._id),
    locationId: String(park._id),
    date: "2026-10-03",
    time: "10:00",
  });
  assert.deepEqual(result.prefilled, {
    petId: String(bob.pet._id),
    myPetId: String(alice.pet._id),
    locationId: String(park._id),
    presetDate: "2026-10-03",
    presetTime: "10:00",
  });
  const chip = blocksFrom(toolset.effects).find((block) => block.type === "links").items[0];
  assert.equal(chip.screen, "SchedulePlaydate");
  assert.equal(chip.label, "Review and send to bob-dog");
  assert.equal(await Playdate.countDocuments({}), 0, "nothing was created");
  assert.equal(await Notification.countDocuments({}), 0, "nobody was told");

  assert.ok((await call(toolset, "plan_playdate", { theirPetId: String(alice.pet._id) })).error, "your own pet is not a guest");
  assert.ok((await call(toolset, "plan_playdate", { theirPetId: String(bob.pet._id), date: "next friday" })).error);
  assert.ok((await call(toolset, "plan_playdate", { theirPetId: String(bob.pet._id), myPetId: String(bob.pet._id) })).error, "myPetId has to be yours");
});

test("pals, articles and places come back as cards with a photo, a subtitle and the tap", async () => {
  const alice = await makeOwner("alice");
  const bob = await makeOwner("bob", { photos: ["https://firebasestorage.googleapis.com/v0/b/x/o/bob.jpg"] });
  await Friend.create({
    status: true, user1: alice.user._id, user2: bob.user._id, pet1: alice.pet._id, pet2: bob.pet._id, creator: alice.user._id,
  });
  const Article = require("../models/Article");
  await Article.create({ title: "Kennel cough, plainly", summary: "What Bordetella is and is not.", content: "Body.", tags: ["dogs"], sources: [{ title: "AAHA", publisher: "AAHA", url: "https://aaha.org" }] });

  const toolset = toolsFor({ userId: alice.user._id });
  await call(toolset, "my_pals");
  await call(toolset, "search_articles", { query: "kennel" });
  const cards = blocksFrom(toolset.effects).find((block) => block.type === "cards");
  assert.ok(cards, "a cards block");
  const pal = cards.items.find((item) => item.title === "bob-dog");
  assert.deepEqual(pal, {
    title: "bob-dog",
    subtitle: "Beagle · with @bob",
    image: "https://firebasestorage.googleapis.com/v0/b/x/o/bob.jpg",
    chip: { screen: "PetDetails", params: { petId: String(bob.pet._id) }, label: "Open bob-dog" },
  });
  const article = cards.items.find((item) => item.title === "Kennel cough, plainly");
  assert.equal(article.subtitle, "What Bordetella is and is not.");
  assert.equal(article.chip.screen, "ArticleDetail");
  const links = blocksFrom(toolset.effects).find((block) => block.type === "links");
  assert.ok(!links.items.some((chip) => chip.screen === "ArticleDetail"), "no duplicate chip beside the card");
  assert.ok(links.items.some((chip) => chip.screen === "FriendsList"), "the list chip stays");
});

// ---------------------------------------------------------------------------
// Phase 6: later, knowing PetPals, ringing your vet
// ---------------------------------------------------------------------------

test("remind_me sets a reminder at the owner's offset with an undo, and cancel_reminder undoes back", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });

  const set = await call(toolset, "remind_me", {
    text: "book Bella's booster",
    at: "2027-01-08T09:00:00-07:00",
    petId: String(alice.pet._id),
  });
  assert.equal(new Date(set.runAt).toISOString(), "2027-01-08T16:00:00.000Z");
  const ScheduledJob = require("../models/ScheduledJob");
  const job = await ScheduledJob.findById(set.reminderId).lean();
  assert.equal(job.payload.utcOffsetMinutes, -420, "the offset in the timestamp is what a repeat keeps");
  assert.equal(job.payload.question, "You asked me to remind you: book Bella's booster");
  const done = blocksFrom(toolset.effects).find((block) => block.type === "done");
  assert.deepEqual(done.undo, { kind: "cancelReminder", reminderId: set.reminderId });

  const listed = await call(toolset, "my_reminders");
  assert.deepEqual(listed.reminders.map((r) => r.text), ["book Bella's booster"]);

  const ended = await call(toolset, "cancel_reminder", { reminderId: set.reminderId });
  assert.equal(ended.removed, true);
  const last = blocksFrom(toolset.effects).filter((block) => block.type === "done").at(-1);
  assert.equal(last.undo.kind, "restoreReminder");
  assert.equal(last.undo.text, "book Bella's booster");
  assert.equal(new Date(last.undo.at).toISOString(), "2027-01-08T16:00:00.000Z");
  assert.ok((await call(toolset, "remind_me", { text: "x", at: "yesterday" })).error, "a bad time is an error the model can read");
  assert.ok((await call(toolset, "remind_me", { text: "x", at: "2027-01-08T09:00:00-07:00", petId: "000000000000000000000000" })).error);
});

test("how_petpals_works answers from the table and offers the screen; the route serves it whole", async () => {
  const alice = await makeOwner("alice");
  const toolset = toolsFor({ userId: alice.user._id });
  const result = await call(toolset, "how_petpals_works", { query: "why is my deck empty" });
  assert.equal(result.entries[0].question, "Why is my deck empty?");
  assert.match(result.entries[0].answer, /Arizona/);
  const links = blocksFrom(toolset.effects).find((block) => block.type === "links");
  assert.ok(links.items.some((chip) => chip.screen === "DiscoveryPreferences"));
  const miss = await call(toolset, "how_petpals_works", { query: "zzzz" });
  assert.deepEqual(miss.entries, []);
  assert.match(miss.note, /Help & support/);

  const request = require("supertest");
  const { app } = require("../Server");
  const res = await request(app).get("/api/petcare/help").set("Authorization", `Bearer ${harness.issueToken("alice")}`).expect(200);
  assert.equal(res.body.entries.length, require("../services/appHelp").HELP.length);
  assert.equal(res.body.topics.spot, "Spot");
});

test("a saved place with a phone becomes a calm contacts card; one without says why", async () => {
  const alice = await makeOwner("alice");
  const vet = await Location.create({
    name: "Sunny Vets",
    address: "2 Vet Row",
    placeId: "vet-1",
    phone: "(602) 555-0100",
    categories: ["vet"],
    geoLocation: { type: "Point", coordinates: [-112.07, 33.45] },
  });
  const park = await makePark();
  await Favorite.create({ user: alice.user._id, location: vet._id, creator: alice.user._id });
  await Favorite.create({ user: alice.user._id, location: park._id, creator: alice.user._id });

  const toolset = toolsFor({ userId: alice.user._id });
  const result = await call(toolset, "my_saved_places");
  assert.deepEqual(
    result.places.map((place) => [place.name, place.phone]).sort(),
    [["Sunny Vets", "(602) 555-0100"], [park.name, null]].sort()
  );
  assert.match(result.note, /not been opened/);
  const blocks = blocksFrom(toolset.effects);
  const contacts = blocks.filter((block) => block.type === "contacts");
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].title, "Your saved places");
  assert.deepEqual(contacts[0].items, [{ id: String(vet._id), name: "Sunny Vets", phone: "(602) 555-0100", note: "saved place" }]);
});

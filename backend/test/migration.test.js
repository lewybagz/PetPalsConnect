const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const harness = require("./helpers/harness");

let User;
let Pet;
let Friend;
let FriendRequest;
let mongoose;

const SCRIPT = path.resolve(__dirname, "../scripts/migrate-to-pets.js");
const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");

/**
 * The migration onto pets, run for real.
 *
 * A migration that has only ever been read is a migration nobody has verified,
 * and this one rewrites the key of every existing conversation - get it wrong
 * and two people's thread is silently replaced by two empty ones.
 *
 * So this seeds legacy-shaped rows through the raw collection (the old `petId`
 * is not a path on the schema any more, and Mongoose would strip it before it
 * reached the database), then runs `scripts/migrate-to-pets.js` as a child
 * process against the test server - the actual script, not a copy of its logic.
 */
test.before(async () => {
  await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Friend = require("../models/Friend");
  FriendRequest = require("../models/FriendRequest");
  mongoose = require("mongoose");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

/**
 * Runs the real script against this test's database, returning both streams.
 *
 * The per-row warnings go through `console.warn` and so to stderr, while the
 * summary goes to stdout. An operator running this in a terminal sees both
 * interleaved; a test that captured only stdout would miss the one line that
 * says a conversation was deliberately left alone.
 */
const migrate = (...args) => {
  const run = spawnSync("node", [SCRIPT, ...args], {
    env: { ...process.env, MONGODB_URI: process.env.MONGODB_URI },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, `migration exited ${run.status}:\n${run.stderr}`);
  return `${run.stdout}${run.stderr}`;
};

const owner = async (uid, petNames = [`${uid}-pet`]) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
  });
  const pets = [];
  for (const name of petNames) {
    const pet = await Pet.create({
      name,
      weight: 30,
      breed: "Labrador",
      age: 3,
      owner: user._id,
      creator: user._id,
    });
    pets.push(pet);
    user.pets.push(pet._id);
  }
  await user.save();
  return { user, pets, pet: pets[0] };
};

/** A conversation in the shape this migration exists to move off. */
const legacyChat = async ({ a, b, petId }) => {
  const chats = mongoose.connection.collection("chats");
  const oldKey = SHA256([String(a._id), String(b._id)].sort().join("-"));
  const { insertedId } = await chats.insertOne({
    chatId: oldKey,
    participants: [a._id, b._id],
    petId,
    messages: [],
    media: [],
    mutedBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { _id: insertedId, oldKey };
};

const rawChat = (id) =>
  mongoose.connection.collection("chats").findOne({ _id: id });

test("a legacy conversation is re-keyed onto its two pets", async () => {
  const alice = await owner("mig-alice", ["Bo"]);
  const bob = await owner("mig-bob", ["Sky"]);

  // The old row recorded only the pet that was tapped to open the thread.
  const { _id, oldKey } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  migrate();

  const after = await rawChat(_id);
  assert.deepEqual(
    (after.pets ?? []).map(String).sort(),
    [String(alice.pet._id), String(bob.pet._id)].sort()
  );
  assert.equal(after.petId, undefined, "the old single pet should be gone");
  assert.notEqual(after.chatId, oldKey, "the key should have changed");

  // And the new key is the one `findOrCreateChat` will compute, or the next
  // message in this conversation opens a second, empty thread.
  const expected = SHA256(
    [String(alice.pet._id), String(bob.pet._id)].sort().join("-")
  );
  assert.equal(after.chatId, expected);
});

test("the messages and participants on a migrated chat are untouched", async () => {
  const alice = await owner("keep-alice");
  const bob = await owner("keep-bob");
  const { _id } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  const messageId = new mongoose.Types.ObjectId();
  await mongoose.connection
    .collection("chats")
    .updateOne({ _id }, { $set: { messages: [messageId], isPinned: true } });

  migrate();

  const after = await rawChat(_id);
  assert.deepEqual(after.messages.map(String), [String(messageId)]);
  assert.equal(after.isPinned, true);
  assert.deepEqual(
    after.participants.map(String).sort(),
    [String(alice.user._id), String(bob.user._id)].sort()
  );
});

test("a conversation whose pets cannot be resolved is left exactly as it was", async () => {
  const alice = await owner("orphan-alice");
  // No pet at all: a household that never added one.
  const bob = await User.create({
    firebaseUid: "orphan-bob",
    username: "orphan-bob",
    email: "orphan-bob@example.test",
  });

  const { _id, oldKey } = await legacyChat({
    a: alice.user,
    b: bob,
    petId: alice.pet._id,
  });

  const output = migrate();

  const after = await rawChat(_id);
  // Left alone rather than given a wrong key or dropped. It keeps working:
  // `getUserChats` filters on participants, not on the key.
  assert.equal(after.chatId, oldKey);
  assert.equal(after.pets, undefined);
  assert.equal(String(after.petId), String(alice.pet._id));
  assert.match(output, /could not resolve two distinct pets/);
});

test("running it twice changes nothing the second time", async () => {
  const alice = await owner("twice-alice");
  const bob = await owner("twice-bob");
  const { _id } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  migrate();
  const first = await rawChat(_id);

  const second = migrate();
  const after = await rawChat(_id);

  assert.equal(after.chatId, first.chatId);
  assert.deepEqual((after.pets ?? []).map(String), (first.pets ?? []).map(String));
  assert.match(second, /0 chats re-keyed/);
});

test("--dry-run reports what it would do and writes nothing", async () => {
  const alice = await owner("dry-alice");
  const bob = await owner("dry-bob");
  const { _id, oldKey } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  const output = migrate("--dry-run");

  const after = await rawChat(_id);
  assert.equal(after.chatId, oldKey, "dry run must not write");
  assert.equal(after.pets, undefined);
  assert.match(output, /Dry run: nothing will be written/);
  assert.match(output, /1 chats re-keyed/);
});

test("friendships and requests are given each side's pet", async () => {
  const alice = await owner("f-alice", ["Bo"]);
  const bob = await owner("f-bob", ["Sky"]);

  // Written the way the old code did: two users, no animals.
  const [user1, user2] = [String(alice.user._id), String(bob.user._id)].sort();
  await Friend.create({ user1, user2, status: true, creator: user1 });
  await FriendRequest.create({
    sender: alice.user._id,
    receiver: bob.user._id,
    status: "pending",
  });

  migrate();

  const friendship = await Friend.findOne().lean();
  const petFor = (userId) =>
    String(friendship.user1) === String(userId)
      ? String(friendship.pet1)
      : String(friendship.pet2);
  assert.equal(petFor(alice.user._id), String(alice.pet._id));
  assert.equal(petFor(bob.user._id), String(bob.pet._id));

  const request = await FriendRequest.findOne().lean();
  assert.equal(String(request.senderPet), String(alice.pet._id));
  assert.equal(String(request.receiverPet), String(bob.pet._id));
});

test("a household with several pets is migrated onto its first one", async () => {
  // The old key could not distinguish which of these the thread was about -
  // that ambiguity is the reason for the change - so the first pet is the
  // best available answer, and the script says so in its own comments.
  const alice = await owner("many-alice", ["Bo", "Rex", "Nell"]);
  const bob = await owner("many-bob", ["Sky"]);

  const { _id } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  migrate();

  const after = await rawChat(_id);
  assert.deepEqual(
    (after.pets ?? []).map(String).sort(),
    [String(alice.pets[0]._id), String(bob.pet._id)].sort()
  );
});

test("a migrated conversation is the one findOrCreateChat then reuses", async () => {
  const alice = await owner("reuse-alice");
  const bob = await owner("reuse-bob");
  const { _id } = await legacyChat({
    a: alice.user,
    b: bob.user,
    petId: bob.pet._id,
  });

  migrate();

  // The end-to-end property that matters: after migrating, opening the chat
  // from the app must land on the existing thread rather than creating a new
  // one beside it and stranding the history.
  const request = require("supertest");
  const { app } = require("../Server");

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set("Authorization", `Bearer ${harness.issueToken("reuse-alice")}`)
    .send({ petId: String(bob.pet._id) })
    .expect(200);

  assert.equal(String(res.body._id), String(_id));
});

// PowerShell's `>` and pre-6 Set-Content write UTF-16. Read as UTF-8 that is a
// NUL between every letter, so the file parses to nothing and a .env visibly
// holding the URI reports it missing. Tested on buffers: a test must never
// write the real backend/.env to exercise this.
const { decodeEnv } = require("../scripts/migrate-to-pets.js");

test("the connection string is read whatever encoding the shell wrote", () => {
  const line = "MONGODB_URI=mongodb+srv://u:p@host.mongodb.net/?appName=X";
  const utf16le = (text) => Buffer.from(text, "utf16le");
  const withBom = (bom, buffer) => Buffer.concat([Buffer.from(bom), buffer]);

  const shapes = {
    "utf-8": Buffer.from(line, "utf8"),
    "utf-8 with a BOM": withBom([0xef, 0xbb, 0xbf], Buffer.from(line, "utf8")),
    "utf-16le with a BOM": withBom([0xff, 0xfe], utf16le(line)),
    "utf-16le with no BOM": utf16le(line),
    "utf-16be with a BOM": withBom([0xfe, 0xff], utf16le(line).swap16()),
  };
  for (const [shape, buffer] of Object.entries(shapes)) {
    assert.equal(decodeEnv(buffer), line, `${shape} did not decode`);
  }
});

test("a UTF-8 body is left alone rather than guessed at", () => {
  const body = "PORT=3000\r\nMONGODB_URI=mongodb://localhost/x";
  assert.equal(decodeEnv(Buffer.from(body, "utf8")), body);
  // A leading NUL is not UTF-16LE ASCII and must not be treated as one.
  assert.equal(decodeEnv(Buffer.from(" oops", "utf8")), " oops");
});

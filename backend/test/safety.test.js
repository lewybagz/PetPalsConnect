const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");
const { canTransition, REPORT_STATUSES } = require("../services/reportStates");

/**
 * Blocking and reporting.
 *
 * Both existed as menu items. Neither did anything:
 *
 *   - "Block" posted `{BlockedUser, Owner}` to a lowercase schema, so strict
 *     mode dropped both keys and the save then failed on the two required
 *     fields. No block has ever been written - and nothing read the collection
 *     anyway, so a written one would have changed nothing either.
 *   - "Report" hit a controller whose first statement was
 *     `const report = new report({...})`, a TDZ error on every call. No report
 *     has ever been filed.
 *
 * These are the two things every app with strangers in it is required to have,
 * so this suite is about behaviour rather than storage: after you block
 * someone, can they still reach you?
 */

let app;
let User;
let Pet;
let Report;
let BlockList;

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  Report = require("../models/Report");
  BlockList = require("../models/BlockList");
});

test.after(async () => {
  await harness.stop();
  delete process.env.MODERATOR_EMAILS;
});

test.beforeEach(async () => {
  await harness.clear();
  delete process.env.MODERATOR_EMAILS;
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const signUp = (uid) =>
  User.create({
    firebaseUid: uid,
    username: uid,
    usernameLower: uid.toLowerCase(),
    email: `${uid}@example.test`,
  });

const givePet = (owner, name) =>
  Pet.create({
    name,
    breed: "Beagle",
    age: 3,
    weight: 20,
    owner: owner._id,
    creator: owner._id,
  });

// --- Blocking -------------------------------------------------------------

test("blocking writes a row the owner can read back", async () => {
  const [me, them] = [await signUp("blocker"), await signUp("blocked")];

  const res = await request(app)
    .post("/api/blocklists")
    .set(...auth("blocker"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  assert.equal(String(res.body.owner), String(me._id));
  assert.equal(String(res.body.blockedUser), String(them._id));

  const mine = await request(app)
    .get("/api/blocklists")
    .set(...auth("blocker"))
    .expect(200);

  assert.equal(mine.body.length, 1);
  assert.equal(mine.body[0].blockedUser.username, "blocked");
});

test("the owner is the caller, not whoever the body names", async () => {
  await signUp("blocker");
  const them = await signUp("blocked");
  const bystander = await signUp("bystander");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("blocker"))
    .send({ blockedUser: String(them._id), owner: String(bystander._id) })
    .expect(201);

  // The block belongs to the caller. Otherwise anyone could fill somebody
  // else's block list, which is a quiet way to cut a person off from everyone.
  const planted = await BlockList.find({ owner: bystander._id }).lean();
  assert.equal(planted.length, 0);
});

test("blocking twice is one block", async () => {
  await signUp("blocker");
  const them = await signUp("blocked");

  for (let i = 0; i < 2; i += 1) {
    await request(app)
      .post("/api/blocklists")
      .set(...auth("blocker"))
      .send({ blockedUser: String(them._id) })
      .expect(201);
  }

  assert.equal(await BlockList.countDocuments({}), 1);
});

test("you cannot block yourself", async () => {
  const me = await signUp("solo");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("solo"))
    .send({ blockedUser: String(me._id) })
    .expect(400);
});

test("a blocked person's pets leave the deck, in both directions", async () => {
  const me = await signUp("watcher");
  const them = await signUp("nuisance");
  const mine = await givePet(me, "Bo");
  await givePet(them, "Rex");
  await User.findByIdAndUpdate(me._id, { pets: [mine._id] });

  const before = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("watcher"))
    .expect(200);
  assert.equal(before.body.candidates.length, 1);

  await request(app)
    .post("/api/blocklists")
    .set(...auth("watcher"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  const after = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("watcher"))
    .expect(200);
  assert.equal(after.body.candidates.length, 0);

  // And the other way round: a block you cannot see is still a block. If it
  // only hid them from you, blocking a harasser would leave you in their deck.
  const theirPet = await Pet.findOne({ owner: them._id });
  await User.findByIdAndUpdate(them._id, { pets: [theirPet._id] });

  const theirs = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("nuisance"))
    .expect(200);
  assert.equal(theirs.body.candidates.length, 0);
});

test("a blocked person cannot open a chat with you", async () => {
  const me = await signUp("target");
  const them = await signUp("pest");
  const mine = await givePet(me, "Bo");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("target"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  const res = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("pest"))
    .send({ petId: String(mine._id) })
    .expect(403);

  // Deliberately vague: "they blocked you" confirms the block to a harasser.
  assert.doesNotMatch(res.body.message, /block/i);
});

test("a blocked person cannot send into a chat that already exists", async () => {
  const me = await signUp("author");
  const them = await signUp("replier");
  const mine = await givePet(me, "Bo");

  const chat = await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("replier"))
    .send({ petId: String(mine._id) })
    .expect(200);

  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("replier"))
    .send({ chatId: chat.body._id, text: "hello" })
    .expect(201);

  await request(app)
    .post("/api/blocklists")
    .set(...auth("author"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  await request(app)
    .post("/api/chats/addMessage")
    .set(...auth("replier"))
    .send({ chatId: chat.body._id, text: "hello again" })
    .expect(403);
});

test("a blocked conversation leaves the inbox", async () => {
  const me = await signUp("owner-a");
  const them = await signUp("owner-b");
  const mine = await givePet(me, "Bo");

  await request(app)
    .post("/api/chats/findOrCreate")
    .set(...auth("owner-b"))
    .send({ petId: String(mine._id) })
    .expect(200);

  const before = await request(app)
    .get("/api/chats")
    .set(...auth("owner-a"))
    .expect(200);
  assert.equal(before.body.length, 1);

  await request(app)
    .post("/api/blocklists")
    .set(...auth("owner-a"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  const after = await request(app)
    .get("/api/chats")
    .set(...auth("owner-a"))
    .expect(200);
  assert.equal(after.body.length, 0);
});

test("a blocked person is not findable by name", async () => {
  await signUp("searcher");
  const them = await signUp("hider");

  const before = await request(app)
    .get("/api/users?q=hid")
    .set(...auth("searcher"))
    .expect(200);
  assert.equal(before.body.length, 1);

  await request(app)
    .post("/api/blocklists")
    .set(...auth("searcher"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  // Search was the way round a block: gone from the deck, one query away.
  const after = await request(app)
    .get("/api/users?q=hid")
    .set(...auth("searcher"))
    .expect(200);
  assert.equal(after.body.length, 0);
});

test("a blocked person's profile is not reachable by id either", async () => {
  await signUp("guarded");
  const them = await signUp("intruder");

  await request(app)
    .get(`/api/users/${them._id}`)
    .set(...auth("guarded"))
    .expect(200);

  await request(app)
    .post("/api/blocklists")
    .set(...auth("guarded"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  // Pet records hand their owner's id out freely, so hiding somebody from
  // search and the deck is not enough on its own.
  await request(app)
    .get(`/api/users/${them._id}`)
    .set(...auth("guarded"))
    .expect(404);
});

test("unblocking restores them", async () => {
  await signUp("forgiver");
  const them = await signUp("forgiven");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("forgiver"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  await request(app)
    .delete(`/api/blocklists/user/${them._id}`)
    .set(...auth("forgiver"))
    .expect(200);

  const after = await request(app)
    .get("/api/users?q=forgiven")
    .set(...auth("forgiver"))
    .expect(200);
  assert.equal(after.body.length, 1);
});

test("the blocked person cannot lift the block", async () => {
  const me = await signUp("protected");
  await signUp("unwanted");

  await request(app)
    .post("/api/blocklists")
    .set(...auth("protected"))
    .send({ blockedUser: String((await User.findOne({ username: "unwanted" }))._id) })
    .expect(201);

  await request(app)
    .delete(`/api/blocklists/user/${me._id}`)
    .set(...auth("unwanted"))
    .expect(404);

  assert.equal(await BlockList.countDocuments({}), 1);
});

test("one person's block list is invisible to everybody else", async () => {
  await signUp("private-a");
  const them = await signUp("private-b");

  const created = await request(app)
    .post("/api/blocklists")
    .set(...auth("private-a"))
    .send({ blockedUser: String(them._id) })
    .expect(201);

  await request(app)
    .get(`/api/blocklists/${created.body._id}`)
    .set(...auth("private-b"))
    .expect(404);
});

// --- Reporting ------------------------------------------------------------

test("a report is stored, pending, with the caller as reporter", async () => {
  const me = await signUp("reporter");
  const them = await signUp("reported");

  const res = await request(app)
    .post("/api/reports")
    .set(...auth("reporter"))
    .send({
      reportedUser: String(them._id),
      reason: "harassment",
      content: "Kept messaging after I asked them to stop.",
    })
    .expect(201);

  assert.equal(res.body.report.status, "pending");
  assert.equal(res.body.report.reason, "harassment");
  assert.equal(String(res.body.report.reporter), String(me._id));
});

test("reporting somebody blocks them", async () => {
  await signUp("reporter");
  const them = await signUp("reported");

  const res = await request(app)
    .post("/api/reports")
    .set(...auth("reporter"))
    .send({ reportedUser: String(them._id), content: "Abusive." })
    .expect(201);

  assert.equal(res.body.blocked, true);

  // Asking somebody who has just said they feel unsafe to keep looking at the
  // reason is not a thing to ship.
  const after = await request(app)
    .get("/api/users?q=reported")
    .set(...auth("reporter"))
    .expect(200);
  assert.equal(after.body.length, 0);
});

test("a client cannot file a report already marked resolved", async () => {
  await signUp("sneak");
  const them = await signUp("victim");

  const res = await request(app)
    .post("/api/reports")
    .set(...auth("sneak"))
    .send({
      reportedUser: String(them._id),
      content: "Nothing to see here.",
      status: "dismissed",
    })
    .expect(201);

  assert.equal(res.body.report.status, "pending");
});

test("an unknown reason falls back rather than failing validation", async () => {
  await signUp("vague");
  const them = await signUp("vague-target");

  const res = await request(app)
    .post("/api/reports")
    .set(...auth("vague"))
    .send({ reportedUser: String(them._id), reason: "vibes", content: "Odd." })
    .expect(201);

  assert.equal(res.body.report.reason, "other");
});

test("a report needs a description", async () => {
  await signUp("terse");
  const them = await signUp("terse-target");

  await request(app)
    .post("/api/reports")
    .set(...auth("terse"))
    .send({ reportedUser: String(them._id), content: "   " })
    .expect(400);
});

test("filing the same report twice does not double-count", async () => {
  await signUp("repeat");
  const them = await signUp("repeat-target");

  for (let i = 0; i < 3; i += 1) {
    await request(app)
      .post("/api/reports")
      .set(...auth("repeat"))
      .send({ reportedUser: String(them._id), content: "Same complaint." })
      .expect(201);
  }

  assert.equal(await Report.countDocuments({}), 1);

  // Otherwise one determined account could reach the suspension threshold by
  // tapping the button three times.
  const stored = await User.findById(them._id).lean();
  assert.notEqual(stored.suspended, true);
});

test("three separate reporters hide the account", async () => {
  const them = await signUp("problem");

  for (const uid of ["one", "two", "three"]) {
    await signUp(uid);
    await request(app)
      .post("/api/reports")
      .set(...auth(uid))
      .send({ reportedUser: String(them._id), content: `Reported by ${uid}.` })
      .expect(201);
  }

  const stored = await User.findById(them._id).lean();
  assert.equal(stored.suspended, true);

  // Suspension is what makes reporting mean something when nobody is watching
  // the queue: the account stops appearing in front of people.
  await signUp("innocent");
  const search = await request(app)
    .get("/api/users?q=problem")
    .set(...auth("innocent"))
    .expect(200);
  assert.equal(search.body.length, 0);
});

test("a suspended account's pets leave everyone's deck", async () => {
  const them = await signUp("shouty");
  const petOfTheirs = await givePet(them, "Rex");
  assert.ok(petOfTheirs);

  const me = await signUp("bystander");
  const mine = await givePet(me, "Bo");
  await User.findByIdAndUpdate(me._id, { pets: [mine._id] });

  const before = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("bystander"))
    .expect(200);
  assert.equal(before.body.candidates.length, 1);

  await User.findByIdAndUpdate(them._id, { suspended: true });

  const after = await request(app)
    .get("/api/petmatches/discover")
    .set(...auth("bystander"))
    .expect(200);
  assert.equal(after.body.candidates.length, 0);
});

test("you cannot report yourself", async () => {
  const me = await signUp("narcissist");

  await request(app)
    .post("/api/reports")
    .set(...auth("narcissist"))
    .send({ reportedUser: String(me._id), content: "I did it." })
    .expect(400);
});

test("your reports are yours alone", async () => {
  await signUp("author-a");
  const them = await signUp("author-b");

  const created = await request(app)
    .post("/api/reports")
    .set(...auth("author-a"))
    .send({ reportedUser: String(them._id), content: "Private." })
    .expect(201);

  await request(app)
    .get(`/api/reports/${created.body.report._id}`)
    .set(...auth("author-b"))
    .expect(404);

  const theirs = await request(app)
    .get("/api/reports")
    .set(...auth("author-b"))
    .expect(200);
  assert.equal(theirs.body.length, 0);
});

// --- The moderation queue --------------------------------------------------

test("the queue is invisible without the allowlist", async () => {
  await signUp("nosy");

  await request(app)
    .get("/api/reports/queue")
    .set(...auth("nosy"))
    .expect(404);
});

test("a moderator sees the queue and can action a report", async () => {
  process.env.MODERATOR_EMAILS = "mod@example.test";
  await User.create({
    firebaseUid: "mod",
    username: "mod",
    usernameLower: "mod",
    email: "mod@example.test",
  });
  harness.issueToken("mod", { email: "mod@example.test" });

  await signUp("complainant");
  const them = await signUp("accused");

  const created = await request(app)
    .post("/api/reports")
    .set(...auth("complainant"))
    .send({ reportedUser: String(them._id), content: "Sent abuse." })
    .expect(201);

  const queue = await request(app)
    .get("/api/reports/queue")
    .set("Authorization", `Bearer ${harness.issueToken("mod", { email: "mod@example.test" })}`)
    .expect(200);
  assert.equal(queue.body.length, 1);

  await request(app)
    .patch(`/api/reports/${created.body.report._id}/status`)
    .set("Authorization", `Bearer ${harness.issueToken("mod", { email: "mod@example.test" })}`)
    .send({ status: "actioned", resolution: "Account hidden" })
    .expect(200);

  const stored = await User.findById(them._id).lean();
  assert.equal(stored.suspended, true);
});

test("a decided report is not quietly reopened", async () => {
  process.env.MODERATOR_EMAILS = "mod2@example.test";
  await User.create({
    firebaseUid: "mod2",
    username: "mod2",
    usernameLower: "mod2",
    email: "mod2@example.test",
  });
  const modAuth = [
    "Authorization",
    `Bearer ${harness.issueToken("mod2", { email: "mod2@example.test" })}`,
  ];

  await signUp("filer");
  const them = await signUp("filed-against");

  const created = await request(app)
    .post("/api/reports")
    .set(...auth("filer"))
    .send({ reportedUser: String(them._id), content: "A misunderstanding." })
    .expect(201);

  await request(app)
    .patch(`/api/reports/${created.body.report._id}/status`)
    .set(...modAuth)
    .send({ status: "dismissed", resolution: "No case to answer" })
    .expect(200);

  await request(app)
    .patch(`/api/reports/${created.body.report._id}/status`)
    .set(...modAuth)
    .send({ status: "actioned" })
    .expect(409);
});

// --- The state machine itself ---------------------------------------------

test("only the declared transitions are legal", () => {
  assert.ok(canTransition("pending", "reviewing"));
  assert.ok(canTransition("pending", "dismissed"));
  assert.ok(canTransition("reviewing", "actioned"));

  assert.ok(!canTransition("actioned", "pending"));
  assert.ok(!canTransition("dismissed", "reviewing"));
  assert.ok(!canTransition("pending", "invented"));
});

test("every status is reachable and every state is declared", () => {
  const { REPORT_TRANSITIONS } = require("../services/reportStates");

  assert.deepEqual(Object.keys(REPORT_TRANSITIONS).sort(), [...REPORT_STATUSES].sort());

  for (const targets of Object.values(REPORT_TRANSITIONS)) {
    for (const target of targets) {
      assert.ok(
        REPORT_STATUSES.includes(target),
        `${target} is a transition target but not a status`
      );
    }
  }
});

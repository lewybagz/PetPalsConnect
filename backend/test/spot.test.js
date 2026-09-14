const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let User;
let Pet;
let SpotConversation;
let SpotUsage;
let client;
let quota;
let limits;
let realtime;

/**
 * Spot over HTTP, with a scriptable stand-in for the SDK.
 *
 * The stub is handed to `services/spot/client` in place of the real client.
 * Its `script` decides what "the model" does with each request: which tools
 * to call, with what, and what to say. The tools it calls are the real ones,
 * bound to the real caller by the real controller - so what these tests
 * prove is the wiring the model cannot see: consent, quota, scoping, the
 * blocks, what is stored and what is not.
 */
const stub = {
  script: null,
  requests: [],
  beta: {
    messages: {
      toolRunner(params) {
        stub.requests.push(params);
        let pending = null;
        const run = async () => {
          const plan = await stub.script(params);
          for (const call of plan.calls ?? []) {
            const tool = params.tools.find((t) => t.name === call.name);
            if (!tool) throw new Error(`the model asked for ${call.name}, which is not offered`);
            await tool.run(call.input ?? {});
          }
          return {
            content: [{ type: "text", text: plan.text ?? "" }],
            stop_reason: plan.stop_reason ?? "end_turn",
            usage: { input_tokens: 12, output_tokens: 8, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          };
        };
        return {
          async *[Symbol.asyncIterator]() {
            pending = run();
            const message = await pending;
            yield {
              on(event, fn) {
                if (event === "text") fn(message.content[0].text, message.content[0].text);
              },
              finalMessage: async () => message,
            };
          },
          done: () => pending ?? run(),
          pushMessages() {},
        };
      },
    },
  },
};

const say = (text, calls = []) => {
  stub.script = async () => ({ text, calls });
};

test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  Pet = require("../models/Pet");
  SpotConversation = require("../models/SpotConversation");
  SpotUsage = require("../models/SpotUsage");
  client = require("../services/spot/client");
  quota = require("../services/spot/quota");
  limits = require("../middleware/rateLimits");
  realtime = require("../services/realtime");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.MODERATOR_EMAILS;
  client.setClient(stub);
  stub.requests = [];
  say("Hello.");
  limits.setEnabled(false);
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwner = async (uid, userFields = {}) => {
  const user = await User.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@example.test`,
    spotConsentAt: new Date(),
    ...userFields,
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
  });
  await User.findByIdAndUpdate(user._id, { $push: { pets: pet._id } });
  return { user, pet };
};

const startConversation = async (uid) => {
  const res = await request(app).post("/api/spot/conversations").set(...auth(uid)).expect(201);
  return res.body._id;
};

const send = (uid, conversationId, body) =>
  request(app)
    .post(`/api/spot/conversations/${conversationId}/messages`)
    .set(...auth(uid))
    .send(typeof body === "string" ? { text: body } : body);

// ---------------------------------------------------------------------------
// Off, on, and agreed
// ---------------------------------------------------------------------------

test("without a key Spot is off: status says so and every route answers 503", async () => {
  await makeOwner("alice");
  delete process.env.ANTHROPIC_API_KEY;

  const status = await request(app).get("/api/spot/status").set(...auth("alice")).expect(200);
  assert.equal(status.body.enabled, false);
  assert.equal(status.body.quota, null);

  await request(app).post("/api/spot/conversations").set(...auth("alice")).expect(503);
  await request(app).post("/api/spot/consent").set(...auth("alice")).expect(503);

  const health = await request(app).get("/health").expect(200);
  assert.equal(health.body.spot, "not configured");
});

test("status reports consent and today's quota", async () => {
  await makeOwner("alice", { spotConsentAt: undefined });
  const res = await request(app).get("/api/spot/status").set(...auth("alice")).expect(200);
  assert.equal(res.body.enabled, true);
  assert.equal(res.body.consented, false);
  assert.deepEqual(res.body.quota, { used: 0, limit: quota.FREE_PER_DAY, premium: false });
});

test("nothing is sent to the model until the person has agreed", async () => {
  await makeOwner("alice", { spotConsentAt: undefined });
  const id = await startConversation("alice");

  const refused = await send("alice", id, "hello").expect(403);
  assert.equal(refused.body.code, "SPOT_CONSENT_REQUIRED");
  assert.equal(stub.requests.length, 0);

  await request(app).post("/api/spot/consent").set(...auth("alice")).expect(200);
  await send("alice", id, "hello").expect(201);
  assert.equal(stub.requests.length, 1);

  // The first date is kept.
  const first = await User.findById((await User.findOne({ username: "alice" }))._id).select("spotConsentAt").lean();
  await request(app).post("/api/spot/consent").set(...auth("alice")).expect(200);
  const again = await User.findOne({ username: "alice" }).select("spotConsentAt").lean();
  assert.equal(String(again.spotConsentAt), String(first.spotConsentAt));
});

// ---------------------------------------------------------------------------
// A turn
// ---------------------------------------------------------------------------

test("a message runs the tools as the caller, stores both turns, and returns the blocks", async () => {
  const alice = await makeOwner("alice");
  const id = await startConversation("alice");

  stub.script = async (params) => {
    // The system prompt is frozen and carries the cache breakpoint.
    assert.equal(params.system[0].cache_control.type, "ephemeral");
    assert.ok(params.tools.some((t) => t.name === "my_pets"));
    return {
      text: "Logged alice-dog at 26 lb. Her weight history is one tap away.",
      calls: [
        { name: "my_pets" },
        { name: "log_weight", input: { petId: String(alice.pet._id), pounds: 26 } },
      ],
    };
  };

  const res = await send("alice", id, "log her at 26 pounds").expect(201);
  assert.equal(res.body.userMessage.role, "user");
  assert.equal(res.body.message.role, "assistant");
  assert.ok(res.body.message.text.startsWith("Logged"));
  assert.deepEqual(res.body.quota, { used: 1, limit: quota.FREE_PER_DAY, premium: false });

  const kinds = res.body.message.blocks.map((block) => block.type);
  assert.ok(kinds.includes("done"), "the write is shown");
  assert.ok(kinds.includes("links"), "and the screen it lives on is offered");
  const done = res.body.message.blocks.find((block) => block.type === "done");
  assert.equal(done.undo.kind, "removeWeight");

  const pet = await Pet.findById(alice.pet._id).select("weight").lean();
  assert.equal(pet.weight, 26, "the write really happened, through the one writer");

  const stored = await SpotConversation.findById(id).lean();
  assert.equal(stored.messages.length, 2);
  assert.equal(stored.title, "log her at 26 pounds");
  assert.deepEqual(stored.messages[1].blocks.map((b) => b.type), kinds);

  // History is text turns only.
  say("Yes.");
  await send("alice", id, "is that heavier than last time?").expect(201);
  const second = stub.requests[1];
  assert.equal(second.messages.length, 3);
  assert.equal(second.messages[0].content, "log her at 26 pounds");
  assert.equal(second.messages[1].role, "assistant");
});

test("a toxin turn carries the helpline numbers whatever the model said", async () => {
  await makeOwner("alice");
  const id = await startConversation("alice");
  say("Grapes are in the table as an emergency for dogs.", [{ name: "toxin_lookup", input: { query: "grapes" } }]);

  const res = await send("alice", id, "she ate grapes").expect(201);
  const contacts = res.body.message.blocks.find((block) => block.type === "contacts");
  assert.ok(contacts, "the numbers are attached mechanically");
  assert.ok(contacts.items.length >= 2);
});

test("markdown in the reply is stripped, because nothing renders it", async () => {
  await makeOwner("alice");
  const id = await startConversation("alice");
  say("## Rabies\n\n**Current** until 2029.\n\n- DHPP: no date");

  const res = await send("alice", id, "status?").expect(201);
  assert.equal(res.body.message.text, "Rabies\n\nCurrent until 2029.\n\nDHPP: no date");
});

test("a refusal from the model is a polite sentence, not an error", async () => {
  await makeOwner("alice");
  const id = await startConversation("alice");
  stub.script = async () => ({ text: "", stop_reason: "refusal" });

  const res = await send("alice", id, "something").expect(201);
  assert.ok(res.body.message.text.includes("can't help with that one"));
  assert.deepEqual(res.body.message.blocks, []);
});

test("a failed model call refunds the turn and leaves the question in the transcript", async () => {
  const alice = await makeOwner("alice");
  const id = await startConversation("alice");
  stub.script = async () => {
    throw new Error("upstream down");
  };

  const res = await send("alice", id, "hello?").expect(502);
  assert.equal(res.body.code, "SPOT_FAILED");

  const used = await quota.usedToday({ userId: alice.user._id, day: quota.dayFor() });
  assert.equal(used, 0, "a turn the model never completed is not spent");

  const stored = await SpotConversation.findById(id).lean();
  assert.equal(stored.messages.length, 1);
  assert.equal(stored.messages[0].role, "user");
});

test("text is streamed to the owner's socket room while the answer is being written", async () => {
  const alice = await makeOwner("alice");
  const id = await startConversation("alice");
  const emitted = [];
  realtime.setIO({ to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) });
  try {
    say("Streamed words.");
    await send("alice", id, "hi").expect(201);
  } finally {
    realtime.setIO(null);
  }
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, String(alice.user._id));
  assert.equal(emitted[0].event, "spotDelta");
  assert.equal(emitted[0].payload.conversationId, id);
  assert.equal(emitted[0].payload.text, "Streamed words.");
});

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

test("a photo reaches the model and is never stored", async () => {
  await makeOwner("alice");
  const id = await startConversation("alice");
  say("That looks like a lily. Lilies are an emergency for cats.");

  const data = Buffer.from("not really a jpeg").toString("base64");
  const res = await send("alice", id, {
    text: "what plant is this?",
    image: { data, mediaType: "image/jpeg", width: 1024, height: 768 },
  }).expect(201);

  const sent = stub.requests[0].messages.at(-1).content;
  assert.equal(sent[0].type, "image");
  assert.equal(sent[0].source.data, data);
  assert.equal(sent[1].text, "what plant is this?");

  assert.deepEqual(res.body.userMessage.attachments, [{ kind: "photo", width: 1024, height: 768 }]);
  const stored = await SpotConversation.findById(id).lean();
  assert.equal(JSON.stringify(stored).includes(data), false, "the bytes are gone when the request ends");

  const bad = await send("alice", id, { image: { data, mediaType: "image/gif" } }).expect(400);
  assert.equal(bad.body.code, "IMAGE_TYPE");
});

// ---------------------------------------------------------------------------
// Whose conversation
// ---------------------------------------------------------------------------

test("an outsider cannot read, write to, or delete somebody else's conversation", async () => {
  await makeOwner("alice");
  await makeOwner("bob");
  const id = await startConversation("alice");
  await send("alice", id, "private").expect(201);

  await request(app).get(`/api/spot/conversations/${id}`).set(...auth("bob")).expect(404);
  await send("bob", id, "hi").expect(404);
  await request(app).delete(`/api/spot/conversations/${id}`).set(...auth("bob")).expect(404);
  await request(app)
    .post(`/api/spot/conversations/${id}/messages/000000000000000000000000/flag`)
    .set(...auth("bob"))
    .expect(404);

  const list = await request(app).get("/api/spot/conversations").set(...auth("bob")).expect(200);
  assert.deepEqual(list.body, []);
  assert.equal(await SpotConversation.countDocuments({}), 1);
});

test("the sixth conversation evicts the oldest, and says so", async () => {
  await makeOwner("alice");
  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push(await startConversation("alice"));

  const sixth = await request(app).post("/api/spot/conversations").set(...auth("alice")).expect(201);
  assert.equal(sixth.body.evicted, true);
  assert.equal(await SpotConversation.countDocuments({}), 5);
  assert.equal(await SpotConversation.countDocuments({ _id: ids[0] }), 0, "the oldest went");
  assert.equal(await SpotConversation.countDocuments({ _id: ids[4] }), 1);
});

// ---------------------------------------------------------------------------
// Quota and ceiling
// ---------------------------------------------------------------------------

test("the free quota stops at the ceiling and premium lifts it", async () => {
  await makeOwner("free");
  await makeOwner("paid", { subscribed: true });
  const freeId = await startConversation("free");
  const paidId = await startConversation("paid");

  for (let i = 0; i < quota.FREE_PER_DAY; i += 1) await send("free", freeId, `q${i}`).expect(201);
  const over = await send("free", freeId, "one more").expect(429);
  assert.equal(over.body.code, "SPOT_QUOTA");
  assert.equal(over.body.used, quota.FREE_PER_DAY);
  assert.equal(over.body.limit, quota.FREE_PER_DAY);
  assert.equal(over.body.premium, false);
  assert.equal(stub.requests.length, quota.FREE_PER_DAY, "the refused turn never reached the model");

  for (let i = 0; i <= quota.FREE_PER_DAY; i += 1) await send("paid", paidId, `q${i}`).expect(201);
  const status = await request(app).get("/api/spot/status").set(...auth("paid")).expect(200);
  assert.equal(status.body.quota.limit, quota.PREMIUM_PER_DAY);
  assert.equal(status.body.quota.used, quota.FREE_PER_DAY + 1);
});

test("the day is the person's own day", () => {
  const late = new Date("2026-09-12T23:30:00Z");
  assert.equal(quota.dayFor(late, 0), "2026-09-12");
  assert.equal(quota.dayFor(late, 60), "2026-09-13", "an hour east of UTC it is already tomorrow");
  assert.equal(quota.dayFor(late, -420), "2026-09-12", "Arizona is still on the same day");
  assert.equal(quota.dayFor(late, 99999), quota.dayFor(late, 14 * 60), "a nonsense offset is clamped");
});

test("the abuse ceiling under the quota arms per account", async () => {
  await makeOwner("alice");
  limits.setEnabled(true);
  try {
    let limited = 0;
    for (let i = 0; i < 35; i += 1) {
      const res = await request(app).post("/api/spot/consent").set(...auth("alice"));
      if (res.status === 429) limited += 1;
    }
    assert.ok(limited > 0, "thirty-five posts in a second should meet the ceiling");
    // Reads are the screen opening; they never count.
    await request(app).get("/api/spot/status").set(...auth("alice")).expect(200);
  } finally {
    limits.setEnabled(false);
  }
});

// ---------------------------------------------------------------------------
// Flagging, the chats setting, and deletion
// ---------------------------------------------------------------------------

test("an answer can be flagged, and only a moderator can read the flags", async () => {
  await makeOwner("alice");
  await makeOwner("mod");
  const id = await startConversation("alice");
  say("Give it two aspirin.");
  const res = await send("alice", id, "headache?").expect(201);

  await request(app)
    .post(`/api/spot/conversations/${id}/messages/${res.body.message._id}/flag`)
    .set(...auth("alice"))
    .send({ reason: "that is a dose" })
    .expect(200);
  // The person's own question cannot be flagged - only Spot's answers.
  await request(app)
    .post(`/api/spot/conversations/${id}/messages/${res.body.userMessage._id}/flag`)
    .set(...auth("alice"))
    .expect(404);

  await request(app).get("/api/spot/flagged").set(...auth("alice")).expect(404);
  process.env.MODERATOR_EMAILS = "mod@example.test";
  const flagged = await request(app).get("/api/spot/flagged").set(...auth("mod")).expect(200);
  assert.equal(flagged.length ?? flagged.body.length, 1);
  assert.equal(flagged.body[0].reason, "that is a dose");
  assert.equal(flagged.body[0].question, "headache?");
  assert.equal(flagged.body[0].answer, "Give it two aspirin.");
});

test("the chats tool is offered to the model only when the setting is on", async () => {
  await makeOwner("alice");
  const id = await startConversation("alice");

  await send("alice", id, "hi").expect(201);
  assert.ok(!stub.requests[0].tools.some((t) => t.name === "my_chats"));

  await request(app).patch("/api/users/me/settings").set(...auth("alice")).send({ spot: { readChats: true } }).expect(200);
  await send("alice", id, "hi again").expect(201);
  assert.ok(stub.requests[1].tools.some((t) => t.name === "my_chats"));
});

test("deleting the account deletes the conversations and the usage rows", async () => {
  const alice = await makeOwner("alice");
  const id = await startConversation("alice");
  await send("alice", id, "hi").expect(201);
  assert.equal(await SpotUsage.countDocuments({ owner: alice.user._id }), 1);

  await request(app).delete("/api/users/me").set(...auth("alice")).expect(200);

  assert.equal(await SpotConversation.countDocuments({ owner: alice.user._id }), 0);
  assert.equal(await SpotUsage.countDocuments({ owner: alice.user._id }), 0);
});

// ---------------------------------------------------------------------------
// Phase 4: the roster on the message, the cost on the row, notes, usage
// ---------------------------------------------------------------------------

test("the roster rides on the user turn, and the turn's cost lands on the answer", async () => {
  const alice = await makeOwner("alice");
  await User.updateOne({ _id: alice.user._id }, { $push: { spotNotes: { text: "alice-dog hates rain" } } });
  const id = await startConversation("alice");

  say("Hello.");
  const res = await send("alice", id, { text: "hi", utcOffsetMinutes: -420 }).expect(201);

  const turn = stub.requests[0].messages.at(-1);
  assert.equal(turn.role, "user");
  assert.equal(turn.content[0].text, "hi", "the person's words come first");
  const note = turn.content[1].text;
  assert.match(note, /where the owner is/);
  assert.match(note, new RegExp(`alice-dog \\(petId ${alice.pet._id}\\): dog, Beagle, 3 years, 20 lb`));
  assert.match(note, /alice-dog hates rain/);
  assert.ok(!stub.requests[0].system[0].text.includes("alice"), "the system prompt stays frozen");

  assert.deepEqual(res.body.message.usage, {
    model: client.model(),
    input: 12,
    output: 8,
    cacheRead: 0,
    cacheWrite: 0,
    iterations: 1,
    ms: res.body.message.usage.ms,
  });
  const stored = await SpotConversation.findById(id).lean();
  assert.equal(stored.messages[1].usage.input, 12);
  assert.equal(stored.messages[0].usage, undefined, "the person's turn costs nothing");

  // Turn two: the history's last message carries the second cache breakpoint.
  say("Still here.");
  await send("alice", id, "and again").expect(201);
  const history = stub.requests[1].messages;
  assert.equal(history.length, 3);
  assert.deepEqual(history[1].content[0].cache_control, { type: "ephemeral" });
  assert.equal(typeof history[0].content, "string");
});

test("notes are the caller's own, and the usage summary is a moderator's", async () => {
  const alice = await makeOwner("alice");
  await makeOwner("bob");
  await makeOwner("mod");
  const id = await startConversation("alice");
  stub.script = async () => ({ text: "Noted.", calls: [{ name: "remember", input: { text: "alice-dog hates rain" } }] });
  const res = await send("alice", id, "remember that she hates rain").expect(201);
  const done = res.body.message.blocks.find((block) => block.type === "done");
  assert.equal(done.undo.kind, "forget");

  const mine = await request(app).get("/api/spot/notes").set(...auth("alice")).expect(200);
  assert.equal(mine.body.length, 1);
  assert.equal(mine.body[0].text, "alice-dog hates rain");
  const theirs = await request(app).get("/api/spot/notes").set(...auth("bob")).expect(200);
  assert.deepEqual(theirs.body, []);
  await request(app).delete(`/api/spot/notes/${mine.body[0]._id}`).set(...auth("bob")).expect(404);
  await request(app).post("/api/spot/notes").set(...auth("bob")).send({ text: "  " }).expect(400);
  const added = await request(app).post("/api/spot/notes").set(...auth("alice")).send({ text: "vet is on 7th" }).expect(201);
  assert.equal(added.body.text, "vet is on 7th");
  await request(app).delete(`/api/spot/notes/${mine.body[0]._id}`).set(...auth("alice")).expect(200);
  const after = await User.findById(alice.user._id).select("spotNotes").lean();
  assert.deepEqual(after.spotNotes.map((note) => note.text), ["vet is on 7th"]);

  await request(app).get("/api/spot/usage").set(...auth("alice")).expect(404);
  process.env.MODERATOR_EMAILS = "mod@example.test";
  const usage = await request(app).get("/api/spot/usage").set(...auth("mod")).expect(200);
  assert.equal(usage.body.days, 30);
  assert.equal(usage.body.turns, 1);
  assert.equal(usage.body.models.length, 1);
  assert.equal(usage.body.models[0].model, client.model());
  assert.equal(usage.body.models[0].owners, 1);
  assert.equal(usage.body.models[0].input, 12);
  assert.equal(usage.body.models[0].iterationsPerTurn, 1);
  assert.equal(usage.body.estimatedUsd, client.costOf({ input: 12, output: 8 }));
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { ReadableStream } = require("node:stream/web");

const harness = require("./helpers/harness");

let app;
let User;
let SpotConversation;
let voice;
let client;
let limits;

/**
 * The AI voice: off until configured, then Spot's stored answer text and
 * nothing else goes to the provider, and only the owner of the conversation
 * can ask for it. Provider HTTP is stubbed through `voice.setFetch`.
 */
test.before(async () => {
  app = await harness.start();
  User = require("../models/User");
  SpotConversation = require("../models/SpotConversation");
  voice = require("../services/spot/voice");
  client = require("../services/spot/client");
  limits = require("../middleware/rateLimits");
});

test.after(async () => {
  voice.setFetch(null);
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
  process.env.ANTHROPIC_API_KEY = "test-key";
  client.setClient({});
  delete process.env.SPOT_VOICE_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.SPOT_VOICE_ID;
  voice.setFetch(null);
});

const auth = (uid) => ["Authorization", `Bearer ${harness.issueToken(uid)}`];

const makeOwner = (uid) =>
  User.create({ firebaseUid: uid, username: uid, email: `${uid}@example.test`, spotConsentAt: new Date() });

/** A conversation with one exchange, returning the ids the route needs. */
const seed = async (owner) => {
  const conversation = await SpotConversation.create({
    owner: owner._id,
    messages: [
      { role: "user", text: "is she due?" },
      { role: "assistant", text: "Bella's rabies certificate lapses in 12 days. Your vet can renew it." },
    ],
  });
  return { conversationId: String(conversation._id), userId: String(conversation.messages[0]._id), messageId: String(conversation.messages[1]._id) };
};

const audioPath = ({ conversationId, messageId }) => `/api/spot/conversations/${conversationId}/messages/${messageId}/audio`;

/** A fetch stub answering with a few bytes of "audio" and recording the call. */
const stubProvider = (calls) => {
  voice.setFetch(async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === "content-type" ? "audio/mpeg" : null) },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([0x49, 0x44, 0x33, 0x04]));
          controller.close();
        },
      }),
    };
  });
};

test("no provider means 503, and the status says voice is off", async () => {
  const alice = await makeOwner("alice");
  const ids = await seed(alice);
  const status = await request(app).get("/api/spot/status").set(...auth("alice")).expect(200);
  assert.equal(status.body.voice, false);
  await request(app).get(audioPath(ids)).set(...auth("alice")).expect(503);
  assert.equal(voice.isEnabled(), false);
});

test("a provider name without its key is still off", async () => {
  process.env.SPOT_VOICE_PROVIDER = "openai";
  assert.equal(voice.isEnabled(), false);
  process.env.SPOT_VOICE_PROVIDER = "elevenlabs";
  assert.equal(voice.isEnabled(), false);
  process.env.SPOT_VOICE_PROVIDER = "someone-else";
  process.env.OPENAI_API_KEY = "k";
  assert.equal(voice.isEnabled(), false);
});

test("openai: the answer text and only that is sent, the audio streams back, and the status says so", async () => {
  process.env.SPOT_VOICE_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-test";
  const calls = [];
  stubProvider(calls);
  const alice = await makeOwner("alice");
  const ids = await seed(alice);

  const status = await request(app).get("/api/spot/status").set(...auth("alice")).expect(200);
  assert.equal(status.body.voice, true);

  const res = await request(app).get(audioPath(ids)).set(...auth("alice")).buffer(true).parse((r, cb) => {
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "audio/mpeg");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.deepEqual([...res.body], [0x49, 0x44, 0x33, 0x04]);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/audio/speech");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.input, "Bella's rabies certificate lapses in 12 days. Your vet can renew it.");
  assert.equal(body.model, "gpt-4o-mini-tts");
  assert.equal(body.voice, "coral");
  assert.ok(!body.input.includes("is she due"), "the person's words are never sent");
});

test("elevenlabs: the voice id is in the path, the key in its header, and SPOT_VOICE_ID overrides", async () => {
  process.env.SPOT_VOICE_PROVIDER = "elevenlabs";
  process.env.ELEVENLABS_API_KEY = "el-test";
  process.env.SPOT_VOICE_ID = "voice-xyz";
  const calls = [];
  stubProvider(calls);
  const alice = await makeOwner("alice");
  const ids = await seed(alice);

  await request(app).get(audioPath(ids)).set(...auth("alice")).expect(200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.elevenlabs.io/v1/text-to-speech/voice-xyz?output_format=mp3_44100_128");
  assert.equal(calls[0].init.headers["xi-api-key"], "el-test");
  assert.equal(JSON.parse(calls[0].init.body).model_id, "eleven_flash_v2_5");
});

test("only the owner, only an assistant turn, and a provider failure is a 502 not a stream", async () => {
  process.env.SPOT_VOICE_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-test";
  const calls = [];
  stubProvider(calls);
  const alice = await makeOwner("alice");
  await makeOwner("bob");
  const ids = await seed(alice);

  await request(app).get(audioPath(ids)).set(...auth("bob")).expect(404);
  await request(app).get(audioPath({ ...ids, messageId: ids.userId })).set(...auth("alice")).expect(404);
  assert.equal(calls.length, 0, "nothing reached the provider");

  voice.setFetch(async () => ({ ok: false, status: 429, headers: { get: () => null }, body: null }));
  const failed = await request(app).get(audioPath(ids)).set(...auth("alice")).expect(502);
  assert.equal(failed.body.code, "SPOT_VOICE_FAILED");
});

test("the audio GET counts against the Spot limiter; other GETs do not", () => {
  assert.equal(limits.countsAgainstSpot({ method: "GET", path: "/conversations/c1/messages/m1/audio" }), true);
  assert.equal(limits.countsAgainstSpot({ method: "GET", path: "/conversations/c1" }), false);
  assert.equal(limits.countsAgainstSpot({ method: "GET", path: "/status" }), false);
  assert.equal(limits.countsAgainstSpot({ method: "POST", path: "/conversations" }), true);
});

const openai = require("./openai");
const elevenlabs = require("./elevenlabs");

/**
 * An AI voice for Spot's answers, behind the optional-integration pattern the
 * tracking vendor uses: `SPOT_VOICE_PROVIDER` is read at call time, unset
 * means the audio route answers 503 and the app offers only the phone's own
 * voice. One adapter per provider, each a single HTTP call that returns the
 * audio as a stream; nothing is stored. What is sent is Spot's stored answer
 * text and nothing else - never the person's words, never the roster.
 *
 * The default adapter is OpenAI's small speech model, at roughly a third of
 * ElevenLabs Flash per character (see the phase 5 plan's table); ElevenLabs
 * is the swap when the voice has to be the point.
 */

const ADAPTERS = { openai, elevenlabs };

const provider = () => String(process.env.SPOT_VOICE_PROVIDER || "").toLowerCase();

const adapter = () => ADAPTERS[provider()] ?? null;

const isEnabled = () => {
  const chosen = adapter();
  return Boolean(chosen && chosen.configured());
};

/** The fetch used for provider calls; a test hands in a stub. */
let doFetch = (...args) => globalThis.fetch(...args);
const setFetch = (fn) => {
  doFetch = fn ?? ((...args) => globalThis.fetch(...args));
};

/**
 * Synthesises `text`. Resolves to a `{ status, ok, body, contentType }` where
 * `body` is a web ReadableStream of audio bytes. Throws with `status: 503`
 * when no provider is configured.
 */
const speak = async ({ text }) => {
  const chosen = adapter();
  if (!chosen || !chosen.configured()) {
    throw Object.assign(new Error("No voice is configured on this server."), { status: 503 });
  }
  const request = chosen.request({ text, voice: process.env.SPOT_VOICE_ID || undefined });
  const response = await doFetch(request.url, request.init);
  return {
    ok: response.ok,
    status: response.status,
    body: response.body,
    contentType: response.headers?.get?.("content-type") || "audio/mpeg",
  };
};

module.exports = { provider, isEnabled, speak, setFetch, ADAPTERS };

/**
 * OpenAI speech: `POST /v1/audio/speech` with the small speech model, which
 * returns the audio bytes as the response body and takes a plain-English
 * instruction for the delivery - the same job Spot's prompt does for text.
 * Priced per audio token (about 1.5 cents a minute as of September 2026).
 */

const MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "coral";
const INSTRUCTIONS = "Warm, unhurried and plain. A friend who knows about pets, not a presenter.";

const configured = () => Boolean(process.env.OPENAI_API_KEY);

const request = ({ text, voice = DEFAULT_VOICE }) => ({
  url: "https://api.openai.com/v1/audio/speech",
  init: {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, voice, input: text, instructions: INSTRUCTIONS, response_format: "mp3" }),
  },
});

module.exports = { configured, request, MODEL, DEFAULT_VOICE };

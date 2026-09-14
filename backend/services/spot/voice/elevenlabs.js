/**
 * ElevenLabs Flash: `POST /v1/text-to-speech/{voice_id}` with the `xi-api-key`
 * header; the response body is the audio. Flash is the low-latency model at
 * $50 per million characters (September 2026); the multilingual models are
 * twice that and slower, and Spot's answers are short English paragraphs.
 */

const MODEL = "eleven_flash_v2_5";
/** "Rachel", a stock voice; `SPOT_VOICE_ID` overrides. */
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

const configured = () => Boolean(process.env.ELEVENLABS_API_KEY);

const request = ({ text, voice = DEFAULT_VOICE }) => ({
  url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
  init: {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: MODEL }),
  },
});

module.exports = { configured, request, MODEL, DEFAULT_VOICE };

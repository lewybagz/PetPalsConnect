const client = require("./client");
const { toolsFor } = require("./tools");
const { blocksFrom, stripMarkdown } = require("./blocks");
const { SYSTEM_PROMPT } = require("./prompt");

/**
 * One turn with the model.
 *
 * The SDK's tool runner drives the loop: it calls the tools bound to this
 * owner, feeds the results back, and stops when the model has no more calls.
 * Text is streamed through `onDelta` as it arrives - the controller pushes
 * that through the socket room - and the final message is what gets stored
 * and returned. The stream is decoration on a durable answer, the same
 * posture `notify()` takes with the push.
 *
 * What is bounded, and why:
 * - `max_iterations`: a loop that cannot end is a bill that cannot end.
 * - `max_tokens`: Spot writes paragraphs, not essays.
 * - `effort: low`: chat and lookups do well at low effort; measure before
 *   raising. The prompt carries the judgement.
 * - the prefix (`tools` then `system`) is frozen and the system block carries
 *   the cache breakpoint. `usage.cache_read_input_tokens` is logged so a
 *   silent invalidator shows up as a zero.
 *
 * `fallbacks: "default"` re-runs a request the model's classifiers decline on
 * Anthropic's recommended fallback, server-side; a `refusal` stop reason on
 * the final message means the whole chain declined, and Spot says so plainly.
 */

const MAX_ITERATIONS = 6;
const MAX_TOKENS = 2048;
const REFUSAL_TEXT = "I can't help with that one. Ask me about your pets, or about using PetPals.";

/** History is text turns only; tools re-run rather than replay. */
const historyMessages = (messages = []) =>
  messages
    .filter((message) => message.text)
    .map((message) => ({ role: message.role, content: message.text }));

const userContent = ({ text, image }) => {
  if (!image) return text;
  return [
    {
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    },
    { type: "text", text: text || "What is this?" },
  ];
};

const textOf = (message) =>
  (message.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

/**
 * Runs one turn. Returns `{ text, blocks, usage, stopReason }`.
 *
 * Throws when Spot is off or the API fails; the controller turns the first
 * into a 503 and the second into a 502 with the turn refunded.
 */
const run = async ({ userId, history, text, image, readChats = false, onDelta }) => {
  const anthropic = client.get();
  if (!anthropic) {
    throw Object.assign(new Error("Spot isn't available on this server."), { status: 503 });
  }

  const { tools, effects } = toolsFor({ userId, readChats });

  const runner = anthropic.beta.messages.toolRunner({
    model: client.model(),
    max_tokens: MAX_TOKENS,
    max_iterations: MAX_ITERATIONS,
    stream: true,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools,
    messages: [...historyMessages(history), { role: "user", content: userContent({ text, image }) }],
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  for await (const stream of runner) {
    if (onDelta) stream.on("text", (delta) => onDelta(delta));
    const message = await stream.finalMessage();
    // A long server-side turn can pause; pushing the paused turn back resumes it.
    if (message.stop_reason === "pause_turn") {
      runner.pushMessages({ role: "assistant", content: message.content });
    }
  }

  const final = await runner.done();
  const usage = final.usage ?? {};
  console.log(
    `[spot] ${final.stop_reason} in=${usage.input_tokens ?? 0} out=${usage.output_tokens ?? 0} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`
  );

  if (final.stop_reason === "refusal") {
    return { text: REFUSAL_TEXT, blocks: [], usage, stopReason: "refusal" };
  }

  return {
    text: stripMarkdown(textOf(final)),
    blocks: blocksFrom(effects),
    usage,
    stopReason: final.stop_reason,
  };
};

module.exports = { run, REFUSAL_TEXT, MAX_ITERATIONS, MAX_TOKENS };

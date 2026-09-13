const Anthropic = require("@anthropic-ai/sdk");

/**
 * The one Anthropic client, and whether Spot is on.
 *
 * `ANTHROPIC_API_KEY` is read at call time the way `TRACKING_VENDOR` and
 * `MODERATOR_EMAILS` are, so a test can turn Spot on and off without
 * re-requiring anything and a deployment without the key simply has no
 * Spot: every `/api/spot` route answers 503 and the app hides the entry
 * points. The same "payments are optional" rule the shop and the collar
 * follow - a missing key must never stop the app from opening.
 *
 * The key lives on the server and nowhere else. An `EXPO_PUBLIC_*` variable
 * is public by definition, which is why there is no client-side option.
 */

const DEFAULT_MODEL = "claude-opus-5";

const apiKey = () => process.env.ANTHROPIC_API_KEY || "";

const isEnabled = () => Boolean(apiKey());

/** The model Spot runs on. `SPOT_MODEL` is the one-line cost lever. */
const model = () => process.env.SPOT_MODEL || DEFAULT_MODEL;

let client = null;
let clientKey = "";

/**
 * A client for the current key. Rebuilt if the key changes, which only
 * happens in tests; in production it is built once and kept.
 */
const get = () => {
  const key = apiKey();
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key });
    clientKey = key;
  }
  return client;
};

/** Lets a test hand in a stub in place of the SDK. */
const setClient = (stub) => {
  client = stub;
  clientKey = apiKey();
};

module.exports = { DEFAULT_MODEL, isEnabled, model, get, setClient };

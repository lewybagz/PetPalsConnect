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

/**
 * Dollars per million tokens, from anthropic.com/pricing as of 2026-09-13.
 * Cache reads are a tenth of input; a five-minute cache write is 1.25x. The
 * usage route multiplies stored token counts by these, so a price change is
 * a one-line diff here and the history re-prices itself.
 */
const PRICES = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/** Estimated USD for `{ input, output, cacheRead, cacheWrite }`, or null for an unknown model. */
const costOf = ({ input = 0, output = 0, cacheRead = 0, cacheWrite = 0 } = {}, modelName = model()) => {
  const price = PRICES[modelName];
  if (!price) return null;
  const usd =
    (input * price.input + output * price.output + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25) /
    1_000_000;
  return Number(usd.toFixed(4));
};

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

module.exports = { DEFAULT_MODEL, PRICES, costOf, isEnabled, model, get, setClient };

const fs = require("fs");
const path = require("path");

/**
 * The "my dog ate this, is it bad?" table.
 *
 * A source-controlled JSON file rather than a collection, for the same reason
 * `picks.js` and `emergency.js` are: it is not user data, there is no admin
 * console in this repo to edit it from, nothing writes it at runtime so there
 * is no spam surface, and changing what the app says about chocolate ought to
 * be a reviewed diff. It lives in `content/` beside the articles because it is
 * held to the same sourcing policy - `content/research/standards.md` - and
 * every entry names its source and the year.
 *
 * **It describes published guidance and never prescribes.** No dose, no
 * threshold, no "how much is too much", and no branch that asks how much was
 * eaten and answers whether to worry. That is triage, `topics.md` excludes it
 * explicitly, and it is the one thing this screen must not do: the amount is
 * exactly the judgement the helpline exists to make. Every answer this module
 * produces ends at a phone number, including - especially - a miss.
 *
 * Shipped whole to the app (a few tens of kB) so the lookup works with no
 * network. This is the screen somebody opens in a garage at midnight with one
 * bar of signal, and a spinner is the wrong answer to "my dog ate a bulb".
 */

const SEVERITIES = ["emergency", "call", "avoid"];

/**
 * Ordering, not a risk score. `emergency` is "published guidance says do not
 * wait", `call` is "ring for advice", `avoid` is "keep it away from them, and
 * here is the honest reason it is less alarming than it looks". A number here
 * would invite arithmetic, which is the thing this table refuses to do.
 */
const SEVERITY_RANK = { emergency: 0, call: 1, avoid: 2 };

const TOXINS_PATH = path.join(__dirname, "..", "..", "..", "content", "toxins", "toxins.json");

/**
 * Read once at require time. The file is committed, so a parse failure is a
 * broken build rather than a runtime condition to handle - and failing at boot
 * is much louder than serving an empty poison table, which would read as
 * "nothing here is dangerous".
 */
const TOXINS = JSON.parse(fs.readFileSync(TOXINS_PATH, "utf8"));

/**
 * Lowercase, strip accents and anything that is not a letter or digit.
 *
 * Somebody typing with one hand while holding a dog writes "grapes?" or
 * "Rat-Poison" or "tea tree oil". Normalising both sides means the match does
 * not care.
 */
const normalise = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every string an entry can be found by, normalised once at load. */
const INDEX = TOXINS.map((toxin) => ({
  toxin,
  terms: [toxin.name, ...(toxin.aliases ?? [])].map(normalise).filter(Boolean),
}));

/**
 * Substring match over names and aliases, deliberately not fuzzy.
 *
 * A near-miss on this screen is worse than no match: answering "grapefruit"
 * with the grape entry tells somebody their dog is in kidney danger when it
 * is not, and answering "lily of the valley" with the true-lily entry gets the
 * organ wrong. Exact-ish is the honest behaviour, and a miss is a real answer
 * that still carries the helpline.
 *
 * The match is one-directional on purpose. Letting a stored alias contain the
 * *query* as well as the reverse looks symmetrical and is not: "tea" is an
 * alias of caffeine, so "tea tree" - an entirely different thing, and one
 * where the answer is about cats and the liver rather than the heart - came
 * back as caffeine first. Adding somebody's own word to the front or back of
 * a generic one is how people type, and it must not silently change which
 * organ the answer is about.
 *
 * So a query longer than the stored term only matches a term that is itself a
 * phrase: "sugar free gum" still finds the "sugar free gum" alias, while a
 * bare "tea" can only be found by containment. A single generic word never
 * reaches out to claim a longer query.
 *
 * ponytail: substring scan over ~35 entries. If this ever grows past a few
 * hundred, index by trigram - not before.
 */
const matchesTerm = (candidate, term) => {
  if (candidate.includes(term)) return true;
  if (!candidate.includes(" ")) return false;
  return term.includes(candidate);
};

const search = (query) => {
  const term = normalise(query);
  if (!term) return [];

  const matches = INDEX.filter(({ terms }) =>
    terms.some((candidate) => matchesTerm(candidate, term))
  ).map(({ toxin }) => toxin);

  return [...matches].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name)
  );
};

/** The whole table, ordered the way the screen lists it when nothing is typed. */
const all = () =>
  [...TOXINS].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name)
  );

const bySlug = (slug) => TOXINS.find((toxin) => toxin.slug === slug) ?? null;

module.exports = { TOXINS, SEVERITIES, SEVERITY_RANK, all, search, bySlug, normalise };

/**
 * The objectionable-language filter for text other users will read.
 *
 * Apple 1.2 requires an app with user-generated content to have "a method for
 * filtering objectionable material from being posted" as well as report and
 * block; the app had the second two and not the first. This is the cheap,
 * honest version: a word list applied at the write, refusing the message
 * rather than masking it - a masked slur still says what it meant, and a
 * refusal tells the sender what happened.
 *
 * It catches the obvious, not the determined. The report-and-block path is
 * what handles a person who works around it, and that is fine: the rule is
 * that the app makes an effort, not that it makes abuse impossible.
 *
 * ponytail: English only, stems only, simple leetspeak. Add languages or a
 * hosted classifier when the reports say the list is what is missing.
 */

// Stems, matched at word boundaries after normalisation, so "fucking" and
// "f*cking" are caught and "assassin" and "Scunthorpe" are not.
const BLOCKED_STEMS = [
  "fuck\\w*",
  // Masked vowels: "f*ck" and "sh*t" arrive with the star removed.
  "fck\\w*",
  "fuk\\w*",
  "sht",
  "btch\\w*",
  "shit\\w*",
  "bitch\\w*",
  "asshole\\w*",
  "bastard\\w*",
  "cunt\\w*",
  "dickhead\\w*",
  "pussy",
  "pussies",
  "whore\\w*",
  "slut\\w*",
  "motherfuck\\w*",
  "cocksuck\\w*",
  "twat\\w*",
  "wanker\\w*",
  "nigg\\w*",
  "fag",
  "faggot\\w*",
  "retard\\w*",
  "kike\\w*",
  "spic",
  "spics",
  "chink\\w*",
  "wetback\\w*",
  "tranny",
  "trannies",
  "dyke\\w*",
  "kys",
  "kill yourself",
];

const BLOCKED = new RegExp(`\\b(?:${BLOCKED_STEMS.join("|")})\\b`, "i");

// Common substitutions, then everything that is not a letter becomes a space
// so "f.u.c.k" and "f-u-c-k" collapse to the word they spell.
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };

const normalise = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[01345 7@$!]/g, (c) => LEET[c] ?? c)
    // A star or hash is a masked letter, not a word break.
    .replace(/[*#]/g, "")
    .replace(/[^a-z]+/g, " ")
    .replace(/\b([a-z]) (?=[a-z]\b)/g, "$1")
    .trim();

/** True when the text contains language the app does not carry. */
const containsBlocked = (text) => {
  if (typeof text !== "string" || text.length === 0) return false;
  return BLOCKED.test(text) || BLOCKED.test(normalise(text));
};

const BLOCKED_MESSAGE = "That includes language we don't allow here. Please reword it.";

/**
 * Express helper: answers 422 and returns true when `text` is blocked, so a
 * handler reads `if (refuseBlocked(res, body)) return;`.
 */
const refuseBlocked = (res, text) => {
  if (!containsBlocked(text)) return false;
  res.status(422).json({ message: BLOCKED_MESSAGE, code: "CONTENT_BLOCKED" });
  return true;
};

module.exports = { containsBlocked, refuseBlocked, normalise, BLOCKED_MESSAGE };

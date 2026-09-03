/**
 * Password guidance for signup.
 *
 * Firebase enforces a six-character minimum and nothing else, which is weaker
 * than anything worth shipping. This scores locally so the requirements are
 * visible while typing rather than arriving as a rejection.
 *
 * Deliberately length-led rather than a symbol checklist: length is what
 * actually resists guessing, and forced-composition rules mostly produce
 * "Password1!". NIST SP 800-63B makes the same recommendation.
 */

const MIN_LENGTH = 8;

/** Cheap check for the passwords that show up in every breach list. */
const COMMON = new Set([
  "password", "password1", "12345678", "123456789", "qwerty123", "letmein1",
  "iloveyou", "welcome1", "admin123", "football", "baseball", "sunshine",
  "princess", "dragon123", "monkey12", "abc12345", "passw0rd", "trustno1",
]);

export const passwordRules = [
  {
    id: "length",
    label: `At least ${MIN_LENGTH} characters`,
    test: (value) => value.length >= MIN_LENGTH,
  },
  {
    id: "variety",
    label: "Mixes letters with numbers or symbols",
    test: (value) => /[a-zA-Z]/.test(value) && /[^a-zA-Z]/.test(value),
  },
  {
    id: "notCommon",
    label: "Isn't a commonly used password",
    test: (value) => value.length > 0 && !COMMON.has(value.toLowerCase()),
  },
];

/**
 * Returns { score 0-3, met: Set of rule ids, label, isAcceptable }.
 * Only the length rule is enforced; the rest inform without blocking.
 */
export const scorePassword = (password = "") => {
  const met = new Set(
    passwordRules.filter((rule) => rule.test(password)).map((rule) => rule.id)
  );

  let score = met.size;
  // A genuinely long passphrase is strong even without mixed character classes.
  if (password.length >= 16 && met.has("notCommon")) score = 3;

  return {
    score,
    met,
    isAcceptable: met.has("length") && met.has("notCommon"),
    label: ["Too short", "Weak", "Good", "Strong"][score] ?? "Weak",
  };
};

export { MIN_LENGTH };

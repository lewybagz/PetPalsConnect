import { scorePassword, passwordRules, MIN_LENGTH } from "./passwordStrength";

describe("scorePassword", () => {
  it("rejects anything shorter than the minimum", () => {
    // One character short of the minimum.
    const result = scorePassword("a".repeat(MIN_LENGTH - 2) + "1");
    expect(result.isAcceptable).toBe(false);
    expect(result.met.has("length")).toBe(false);
  });

  it("accepts a password that is long enough and not a common one", () => {
    const result = scorePassword("correct-horse-1");
    expect(result.isAcceptable).toBe(true);
  });

  it("rejects passwords from the common list regardless of length", () => {
    // "password1" is 9 characters, so length alone would have passed it.
    const result = scorePassword("password1");
    expect(result.isAcceptable).toBe(false);
    expect(result.met.has("notCommon")).toBe(false);
  });

  it("matches common passwords case-insensitively", () => {
    expect(scorePassword("PASSWORD1").isAcceptable).toBe(false);
  });

  it("scores a mixed-character password above a letters-only one", () => {
    const mixed = scorePassword("treacle99");
    const letters = scorePassword("treacletree");
    expect(mixed.score).toBeGreaterThan(letters.score);
  });

  it("treats a long passphrase as strong without demanding symbols", () => {
    // Length is what resists guessing; forced composition mostly yields
    // "Password1!". A 16+ character phrase should score top marks.
    const result = scorePassword("several word pet passphrase");
    expect(result.score).toBe(3);
    expect(result.label).toBe("Strong");
  });

  it("returns a usable result for an empty password", () => {
    const result = scorePassword("");
    expect(result.isAcceptable).toBe(false);
    expect(result.score).toBe(0);
  });

  it("handles being called with no argument", () => {
    expect(() => scorePassword()).not.toThrow();
  });

  it("every rule has a label the UI can show", () => {
    for (const rule of passwordRules) {
      expect(typeof rule.label).toBe("string");
      expect(rule.label.length).toBeGreaterThan(0);
    }
  });

  it("reported rules agree with the rule predicates", () => {
    const password = "treacle99";
    const result = scorePassword(password);
    for (const rule of passwordRules) {
      expect(result.met.has(rule.id)).toBe(rule.test(password));
    }
  });
});

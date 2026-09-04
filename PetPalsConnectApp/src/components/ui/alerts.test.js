import fs from "fs";
import path from "path";

/**
 * `Alert` is for destructive confirmations, and nothing else.
 *
 * `Alert.alert` was the app's way of saying anything at all - 157 calls across
 * 48 files - a modal that stops the app and looks like an OS error, shown for
 * "Playdate scheduled" as readily as for a failure. `Toast` replaced it, but
 * "use the toast" is a convention, and a convention with 87 counter-examples
 * in the tree is a suggestion.
 *
 * So: a call is allowed only if it offers a way out. A confirmation has a
 * cancel button; feedback does not, and feedback belongs in a toast. That is
 * the whole rule, and it is checkable, which is the point - the alternative is
 * noticing in review, and nobody noticed for 157 of them.
 */

const SRC = path.resolve(__dirname, "../..");

/** Every source file, tests and the toast host itself excepted. */
const sourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  };
  walk(SRC);
  return out;
};

/** The text of each `Alert.alert(...)` call, brackets balanced. */
const alertCalls = (source) => {
  const calls = [];
  const opener = /\bAlert\.alert\(/g;

  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let index = match.index + match[0].length;
    let depth = 1;

    while (index < source.length && depth > 0) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      index += 1;
    }

    calls.push({
      text: source.slice(match.index, index),
      line: source.slice(0, match.index).split("\n").length,
    });
  }

  return calls;
};

const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("Alert is for destructive confirmations", () => {
  it("no screen uses Alert for feedback", () => {
    const offenders = [];

    for (const file of sourceFiles()) {
      // The toast host documents what it replaced, in prose.
      if (file.endsWith(path.join("ui", "Toast.js"))) continue;

      const source = withoutComments(fs.readFileSync(file, "utf8"));

      for (const call of alertCalls(source)) {
        const confirms = /style:\s*["']cancel["']/.test(call.text);
        if (confirms) continue;

        offenders.push(
          `${path.relative(SRC, file)}:${call.line} - ` +
            `${call.text.replace(/\s+/g, " ").slice(0, 80)}`
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("finds the confirmations, so the check cannot pass vacuously", () => {
    let confirmations = 0;

    for (const file of sourceFiles()) {
      const source = withoutComments(fs.readFileSync(file, "utf8"));
      confirmations += alertCalls(source).filter((call) =>
        /style:\s*["']cancel["']/.test(call.text)
      ).length;
    }

    // Blocking, unblocking, leaving a group, unfriending, deleting a photo,
    // a payment method, a playdate's changes, an account, a subscription, and
    // the two ways out of onboarding.
    expect(confirmations).toBeGreaterThanOrEqual(10);
  });
});

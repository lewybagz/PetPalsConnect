#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * A ratchet on hardcoded colours.
 *
 * The app held 185 hex literals across 55 files and 55 uses of bare CSS colour
 * keywords, which is why the dark-mode switch could not do anything: there was
 * nothing for a theme to change. `src/styles/tokens.ts` is where colour lives
 * now, and `useTailwind()` resolves `bg-surface` and `text-textMuted` against
 * it.
 *
 * A lint rule banning raw hex outright would fail on every unconverted file, so
 * it would have to be disabled everywhere - which is the same as not having it.
 * This is the version that works during a migration: a committed count per
 * file, and a failure if any file gets worse. Converting a screen lowers its
 * number; nothing can raise one. When a file reaches zero it leaves the
 * baseline and can never regress.
 *
 * Same shape as the backend's `check:schemas` and `check:auth`: a static pass
 * over the source that catches a whole class rather than one instance.
 */

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const BASELINE = path.join(__dirname, "colour-baseline.json");

/** Colour lives here by definition. */
const ALLOWED = new Set([path.join("src", "styles", "tokens.ts")]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * Bare CSS keywords in a style position. Matched narrowly - `color: "red"` and
 * `backgroundColor: "white"` - so a `name="white"` icon prop or the word "red"
 * in a sentence is not a finding.
 */
const KEYWORD = /(?:color|Color|borderColor|tintColor)\s*:\s*"(?:white|black|gray|grey|red|blue|green|yellow|orange|purple|transparent)"/g;

const walk = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

/** How many raw colour values each file still holds. */
const count = () => {
  const counts = {};

  for (const file of walk(SRC)) {
    const relative = path.relative(ROOT, file);
    if (ALLOWED.has(relative)) continue;

    const source = fs.readFileSync(file, "utf8");
    const total =
      (source.match(HEX) ?? []).length + (source.match(KEYWORD) ?? []).length;

    if (total > 0) counts[relative] = total;
  }

  return counts;
};

const readBaseline = () =>
  fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};

const audit = () => {
  const baseline = readBaseline();
  const current = count();
  const problems = [];

  for (const [file, total] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (total > allowed) {
      problems.push(
        `${file}: ${total} hardcoded colours, up from ${allowed}. Use a token ` +
          `class (\`bg-surface\`, \`text-textMuted\`) or \`useTokens()\`.`
      );
    }
  }

  return { problems, current, baseline };
};

module.exports = { audit, count, readBaseline, BASELINE };

if (require.main === module) {
  const flag = process.argv[2];
  const { problems, current, baseline } = audit();

  if (flag === "--update") {
    fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Baseline written: ${Object.keys(current).length} files remaining.`);
    process.exit(0);
  }

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(
      "\nIf a colour genuinely belongs here, put it in src/styles/tokens.ts and " +
        "reference it by name. Run `npm run check:colours -- --update` only to " +
        "record a reduction."
    );
    process.exit(1);
  }

  const remaining = Object.values(current).reduce((sum, n) => sum + n, 0);
  const was = Object.values(baseline).reduce((sum, n) => sum + n, 0);
  console.log(
    `No new hardcoded colours. ${remaining} left across ` +
      `${Object.keys(current).length} files (baseline ${was}).`
  );
}

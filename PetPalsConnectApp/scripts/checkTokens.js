#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * No colour outside `src/styles/tokens.ts`.
 *
 * The app held 227 hardcoded colours across 67 files - 185 hex literals and 55
 * bare CSS keywords - which is why the dark-mode switch could not do anything:
 * there was nothing for a theme to change. Colour lives in one module now, and
 * `useTailwind()` resolves `bg-surface` and `text-textMuted` against it.
 *
 * This began as a ratchet, because a rule banning raw hex would have failed in
 * 67 files and had to be disabled in all of them, which is the same as not
 * having one. The baseline is empty now that the migration has landed, so it is
 * simply a ban: the ratchet and the rule are the same code, and the only thing
 * that changed is that there is nothing left to permit.
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
const KEYWORD = /(?:color|Color|borderColor|tintColor)\s*:\s*"(?:white|black|gray|grey|red|blue|green|yellow|orange|purple|transparent|tomato)"/g;

/**
 * Comments are prose, not style.
 *
 * This codebase documents what a change replaced - "six literals, `#767577`,
 * `#81b0ff`..." - and counting those would mean the reward for explaining a
 * migration is a failing build. Stripping them first also stops a commented-out
 * block of old styles from holding a file's number up forever.
 */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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

/**
 * Style objects that set type but never a colour.
 *
 * The blind spot the colour ban cannot see. A `Text` style with a `fontSize`
 * and no `color` inherits React Native's default, which is black - invisible
 * the moment it lands on a dark surface. It was correct while every surface in
 * the app was white, so nothing flagged it, and dark mode turned 44 of them
 * across 28 files into black-on-black. A screenshot found the first one.
 */
const ENTRY = /(\w+):\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

const colourlessText = (source) => {
  const start = source.indexOf("StyleSheet.create({");
  if (start === -1) return [];

  const block = stripComments(source.slice(start));
  const found = [];

  for (const [, key, body] of block.matchAll(ENTRY)) {
    const setsType = /\bfontSize\s*:|\bfontWeight\s*:/.test(body);
    const setsColour = /\bcolor\s*:/.test(body);
    if (setsType && !setsColour) found.push(key);
  }

  return found;
};

/**
 * Tailwind class strings that set type but never a colour.
 *
 * The same blind spot as `colourlessText`, one syntax over - and the larger
 * half of it. `tailwind("text-xl font-bold")` on a `Text` sets a size and
 * leaves the colour to React Native's default, which is black: correct on the
 * white surfaces this app used to have, invisible on a dark one. There were 46
 * of them across 23 files, and the colour ban could not see a single one
 * because a class name is not a hex literal and never was.
 *
 * `${...}` is skipped: a class string built from an expression usually carries
 * its colour in the expression (`text-sm ${hintColour}`), and this check cannot
 * evaluate it. That is a deliberate hole rather than a false positive - the
 * alternative is a rule people learn to work around by interpolating.
 */
const SIZED = /\btext-(xs|sm|base|lg|xl|2xl|3xl)\b|\bfont-(bold|semibold|medium)\b/;
const TONE = /text-(text|textMuted|textFaint|onPrimary|primary|danger|success|warning)\b/;
const TAILWIND_CALL = /tailwind\((["`])([^"`]*)\1\)/g;

const colourlessClasses = (source) => {
  const found = [];

  for (const [, , classes] of stripComments(source).matchAll(TAILWIND_CALL)) {
    if (!SIZED.test(classes)) continue;
    if (TONE.test(classes) || classes.includes("${")) continue;
    found.push(classes.trim());
  }

  return found;
};

/** How many raw colour values each file still holds. */
const count = () => {
  const counts = {};

  for (const file of walk(SRC)) {
    const relative = path.relative(ROOT, file);
    if (ALLOWED.has(relative)) continue;

    const source = stripComments(fs.readFileSync(file, "utf8"));
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

  for (const file of walk(SRC)) {
    const relative = path.relative(ROOT, file);
    if (ALLOWED.has(relative)) continue;

    const source = fs.readFileSync(file, "utf8");

    const keys = colourlessText(source);
    if (keys.length > 0) {
      problems.push(
        `${relative}: ${keys.join(", ")} set type but no colour, so they ` +
          `inherit black and vanish on a dark surface. Add \`color: t.text\`.`
      );
    }

    const classes = colourlessClasses(source);
    if (classes.length > 0) {
      problems.push(
        `${relative}: ${classes.length} tailwind style${
          classes.length === 1 ? "" : "s"
        } set type but no colour, so they inherit black and vanish on a dark ` +
          `surface - e.g. \`${classes[0]}\`. Add \`text-text\` (or another tone).`
      );
    }
  }

  for (const [file, total] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (total > allowed) {
      problems.push(
        `${file}: ${total} hardcoded colour${total === 1 ? "" : "s"}` +
          (allowed > 0 ? `, up from ${allowed}` : "") +
          `. Use a token class (\`bg-surface\`, \`text-textMuted\`) or \`useTokens()\`.`
      );
    }
  }

  return { problems, current, baseline };
};

/** Every file the check looks at, so a pass cannot mean "found no files". */
const scanned = () => walk(SRC).map((file) => path.relative(ROOT, file));

module.exports = {
  audit,
  count,
  colourlessText,
  colourlessClasses,
  scanned,
  readBaseline,
  BASELINE,
};

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
  const permitted = Object.keys(baseline).length;

  console.log(
    remaining === 0 && permitted === 0
      ? `Colour lives only in src/styles/tokens.ts, and every text style names ` +
        `one (${scanned().length} files checked).`
      : `No new hardcoded colours. ${remaining} left across ` +
          `${Object.keys(current).length} files.`
  );
}

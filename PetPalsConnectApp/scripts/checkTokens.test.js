const fs = require("node:fs");
const path = require("node:path");

const { audit, colourlessText, count, scanned, readBaseline } = require("./checkTokens");

/**
 * A guard that passes vacuously is worse than none: it reads like the codebase
 * is protected while the number quietly climbs. This began as a ratchet over
 * 227 hardcoded colours in 67 files; now that the migration has landed and the
 * baseline is empty, the same code is an outright ban - so the thing most worth
 * proving is that it is still looking at the source tree at all.
 */

describe("the colour ban", () => {
  it("passes on the codebase as committed", () => {
    expect(audit().problems).toEqual([]);
  });

  it("is reading the source tree, so a pass cannot mean it found no files", () => {
    const files = scanned();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("src/screens/swipe/DiscoverScreen.js");
  });

  it("finds no colour left outside the token module", () => {
    // The migration is done: 227 across 67 files, down to none.
    expect(count()).toEqual({});
  });

  it("leaves the token file alone, since colour lives there by definition", () => {
    expect(count()["src/styles/tokens.ts"]).toBeUndefined();
  });

  it("permits nothing, now that nothing needs permitting", () => {
    expect(readBaseline()).toEqual({});
  });

  /**
   * Written into a scratch file rather than an existing one.
   *
   * Jest runs suites in parallel workers off one working tree, so mutating a
   * real source file here breaks whichever screen suite happens to import it at
   * that moment - which is exactly the intermittent, unreproducible failure
   * that wastes an afternoon.
   */
  const withScratchFile = (contents, assertion) => {
    const file = path.resolve(__dirname, "../src/__ratchet-scratch.js");
    fs.writeFileSync(file, contents);
    try {
      assertion(audit().problems, "src/__ratchet-scratch.js");
    } finally {
      fs.unlinkSync(file);
    }
  };

  it("fails when a file gains a colour", () => {
    withScratchFile('export const SNEAKY = "#ff00ff";\n', (problems, name) => {
      expect(problems.some((problem) => problem.includes(name))).toBe(true);
    });
  });

  it("catches a bare colour keyword in a style position too", () => {
    // `color: "gray"` bypasses theming exactly as a hex literal does, and there
    // were 55 of them.
    withScratchFile('export const S = { color: "gray" };\n', (problems, name) => {
      expect(problems.some((problem) => problem.includes(name))).toBe(true);
    });
  });

  it("does not flag an icon name that happens to be a colour word", () => {
    withScratchFile('export const NAME = "white";\n', (problems, name) => {
      expect(problems.some((problem) => problem.includes(name))).toBe(false);
    });
  });

  it("catches a text style that names no colour at all", () => {
    // The blind spot the colour count cannot see: a style with a `fontSize` and
    // no `color` inherits black, which is correct on white and invisible on a
    // dark surface. 44 of them across 28 files, and only a screenshot found the
    // first.
    withScratchFile(
      "export const q = StyleSheet.create({ title: { fontSize: 18 } });\n",
      (problems, name) => {
        expect(problems.some((problem) => problem.includes(name))).toBe(true);
      }
    );
  });

  it("accepts a text style that names one", () => {
    withScratchFile(
      "export const q = StyleSheet.create({ title: { fontSize: 18, color: t.text } });\n",
      (problems, name) => {
        expect(problems.some((problem) => problem.includes(name))).toBe(false);
      }
    );
  });

  it("says which keys are at fault, not just which file", () => {
    const keys = colourlessText(
      "StyleSheet.create({ a: { fontSize: 12 }, b: { padding: 4 } })"
    );
    expect(keys).toEqual(["a"]);
  });

  it("does not count a colour quoted in a comment", () => {
    // This codebase documents what a change replaced. Counting those would make
    // the reward for explaining a migration a failing build.
    withScratchFile(
      '// Replaced #767577 and #81b0ff with tokens.\nexport const OK = 1;\n',
      (problems, name) => {
        expect(problems.some((problem) => problem.includes(name))).toBe(false);
      }
    );
  });
});

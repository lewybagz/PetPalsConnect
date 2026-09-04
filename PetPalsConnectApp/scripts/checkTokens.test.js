const fs = require("node:fs");
const path = require("node:path");

const { audit, count, readBaseline } = require("./checkTokens");

/**
 * The ratchet has to actually ratchet.
 *
 * A guard that passes vacuously is worse than none: it reads like the codebase
 * is protected while the number quietly climbs. So this proves it counts real
 * files, that adding a colour fails, and that the baseline it compares against
 * is the one on disk.
 */

describe("the colour ratchet", () => {
  it("passes on the codebase as committed", () => {
    expect(audit().problems).toEqual([]);
  });

  it("is counting real files, so it cannot pass by finding nothing", () => {
    const counts = count();
    expect(Object.keys(counts).length).toBeGreaterThan(10);
  });

  it("leaves the token file alone, since colour lives there by definition", () => {
    expect(count()["src/styles/tokens.ts"]).toBeUndefined();
  });

  it("has a baseline entry for every file that still holds colours", () => {
    const baseline = readBaseline();
    for (const file of Object.keys(count())) {
      expect(baseline[file]).toBeDefined();
    }
  });

  it("fails when a file gains a colour", () => {
    const file = path.resolve(__dirname, "../src/components/ui/Card.js");
    const original = fs.readFileSync(file, "utf8");

    try {
      fs.writeFileSync(
        file,
        original.replace(
          "const Card = ({",
          'const SNEAKY = "#ff00ff";\n\nconst Card = ({'
        )
      );

      const problems = audit().problems;
      expect(problems.some((problem) => problem.includes("Card.js"))).toBe(true);
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  it("catches a bare colour keyword in a style position too", () => {
    // `color: "gray"` bypasses theming exactly as a hex literal does, and there
    // were 55 of them.
    const file = path.resolve(__dirname, "../src/components/ui/Card.js");
    const original = fs.readFileSync(file, "utf8");

    try {
      fs.writeFileSync(
        file,
        original.replace(
          "const Card = ({",
          'const SNEAKY = { color: "gray" };\n\nconst Card = ({'
        )
      );

      expect(audit().problems.some((p) => p.includes("Card.js"))).toBe(true);
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  it("does not flag an icon name that happens to be a colour word", () => {
    const file = path.resolve(__dirname, "../src/components/ui/Card.js");
    const original = fs.readFileSync(file, "utf8");

    try {
      fs.writeFileSync(file, original.replace("const Card = ({", 'const NAME = "white";\n\nconst Card = ({'));
      expect(audit().problems.some((p) => p.includes("Card.js"))).toBe(false);
    } finally {
      fs.writeFileSync(file, original);
    }
  });
});

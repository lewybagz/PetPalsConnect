import { searchToxins, forSpecies, SEVERITY_RANK, SEVERITY_LABELS } from "./toxins";

/**
 * The device-side search. It runs against the cached table, so this logic is
 * what answers the question when there is no signal - which is the case this
 * whole feature is built for.
 */

const TABLE = [
  {
    slug: "grapes-raisins",
    name: "Grapes, raisins and currants",
    aliases: ["grape", "raisin", "sultana"],
    species: ["dog"],
    severity: "emergency",
  },
  {
    slug: "caffeine",
    name: "Caffeine",
    aliases: ["coffee", "tea", "energy drink"],
    species: ["dog", "cat"],
    severity: "call",
  },
  {
    slug: "essential-oils",
    name: "Essential oils",
    aliases: ["essential oil", "tea tree", "tea tree oil", "eucalyptus"],
    species: ["cat", "dog", "bird"],
    severity: "call",
  },
  {
    slug: "silica-gel",
    name: "Silica gel packets",
    aliases: ["silica gel", "desiccant"],
    species: ["dog", "cat"],
    severity: "avoid",
  },
  {
    slug: "xylitol",
    name: "Xylitol and birch sugar",
    aliases: ["xylitol", "sugar free gum", "birch sugar"],
    species: ["dog"],
    severity: "emergency",
  },
];

describe("searchToxins", () => {
  it("finds an entry by the word somebody would actually type", () => {
    expect(searchToxins(TABLE, "grape").map((t) => t.slug)).toEqual(["grapes-raisins"]);
    expect(searchToxins(TABLE, "coffee").map((t) => t.slug)).toEqual(["caffeine"]);
    expect(searchToxins(TABLE, "sugar free gum").map((t) => t.slug)).toEqual(["xylitol"]);
  });

  it("ignores case, punctuation and accents", () => {
    expect(searchToxins(TABLE, "  GRAPES!  ").map((t) => t.slug)).toEqual(["grapes-raisins"]);
    expect(searchToxins(TABLE, "Silica-Gel").map((t) => t.slug)).toEqual(["silica-gel"]);
  });

  it("never lets a generic alias claim a longer query", () => {
    /**
     * The bug this rule exists for: "tea" is an alias of caffeine, so
     * "tea tree" came back as caffeine - the wrong species and the wrong
     * organ. On this screen a near-miss is worse than no match, because the
     * reader acts on it.
     */
    const found = searchToxins(TABLE, "tea tree").map((t) => t.slug);
    expect(found).toEqual(["essential-oils"]);
    expect(found).not.toContain("caffeine");
  });

  it("answers a miss with nothing rather than something approximate", () => {
    expect(searchToxins(TABLE, "banana")).toEqual([]);
    expect(searchToxins(TABLE, "")).toEqual([]);
    expect(searchToxins(TABLE, "   ")).toEqual([]);
    expect(searchToxins(TABLE, null)).toEqual([]);
  });

  it("leads with what cannot wait", () => {
    // "s" matches raisins/sultana, essential oils and silica gel.
    const ranks = searchToxins(TABLE, "s").map((t) => SEVERITY_RANK[t.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("tolerates an entry with no aliases", () => {
    const sparse = [{ slug: "x", name: "Antifreeze", species: ["dog"], severity: "emergency" }];
    expect(searchToxins(sparse, "antifreeze").map((t) => t.slug)).toEqual(["x"]);
  });
});

describe("forSpecies", () => {
  it("narrows to one species when a pet is chosen", () => {
    expect(forSpecies(TABLE, "cat").map((t) => t.slug)).toEqual([
      "caffeine",
      "essential-oils",
      "silica-gel",
    ]);
  });

  it("returns everything when no species is chosen", () => {
    expect(forSpecies(TABLE, null)).toHaveLength(TABLE.length);
  });
});

describe("the severity vocabulary", () => {
  it("says what to do rather than scoring how bad it is", () => {
    expect(Object.keys(SEVERITY_RANK)).toEqual(["emergency", "call", "avoid"]);
    expect(SEVERITY_LABELS.emergency).toBe("Do not wait");
    // No numbers anywhere in what the screen renders.
    for (const label of Object.values(SEVERITY_LABELS)) {
      expect(label).not.toMatch(/\d/);
    }
  });
});

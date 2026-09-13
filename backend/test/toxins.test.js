const test = require("node:test");
const assert = require("node:assert");

const toxins = require("../services/petCare/toxins");

/**
 * The poison table is the highest-stakes content in the app: it is read by
 * somebody who is frightened, in a hurry, and about to act on it. These tests
 * are mostly about what it must *never* say.
 */

test("every entry carries what the screen and the policy both need", () => {
  assert.ok(toxins.TOXINS.length >= 30, "the table should cover the common cases");

  const slugs = new Set();
  for (const toxin of toxins.TOXINS) {
    const where = toxin.slug ?? JSON.stringify(toxin).slice(0, 60);

    assert.match(toxin.slug ?? "", /^[a-z0-9-]+$/, `${where}: slug is a url-safe id`);
    assert.ok(!slugs.has(toxin.slug), `${where}: slug is unique`);
    slugs.add(toxin.slug);

    assert.ok(toxin.name?.trim(), `${where}: has a name`);
    assert.ok(Array.isArray(toxin.aliases) && toxin.aliases.length, `${where}: has aliases`);
    assert.ok(Array.isArray(toxin.species) && toxin.species.length, `${where}: names species`);
    assert.ok(toxins.SEVERITIES.includes(toxin.severity), `${where}: severity is one of ours`);
    assert.ok(toxin.signs?.trim(), `${where}: describes signs`);
    assert.ok(toxin.guidance?.trim(), `${where}: has guidance`);

    // Same rule as content/research/standards.md: a claim with no source is a
    // sentence with no evidence, and this is the corpus where that matters most.
    assert.ok(Array.isArray(toxin.sources) && toxin.sources.length, `${where}: cites a source`);
    for (const source of toxin.sources) {
      assert.ok(source.name?.trim(), `${where}: source is named`);
      assert.match(source.url ?? "", /^https:\/\//, `${where}: source has an https url`);
      assert.ok(Number.isInteger(source.year), `${where}: source names its year`);
    }
  }
});

test("species are the ones the schema actually stores", () => {
  // Article tags and Pet.species are deliberately different vocabularies; this
  // table uses the schema's, because it is filtered against a real pet.
  const SPECIES = ["dog", "cat", "smallMammal", "bird", "reptile", "fish"];
  for (const toxin of toxins.TOXINS) {
    for (const species of toxin.species) {
      assert.ok(SPECIES.includes(species), `${toxin.slug}: "${species}" is a Pet.species value`);
    }
  }
});

test("nothing in the table states a dose, a threshold or an amount", () => {
  /**
   * The rule from CLAUDE.md and content/research/topics.md: no dose a reader
   * could act on, no triage. "How much is dangerous" is exactly the judgement
   * the helpline exists to make, and a number here would invite arithmetic
   * instead of a phone call.
   */
  const { FORBIDDEN } = require("../services/spot/healthLine");

  for (const toxin of toxins.TOXINS) {
    const prose = `${toxin.name} ${toxin.signs} ${toxin.guidance}`;
    for (const pattern of FORBIDDEN) {
      assert.ok(
        !pattern.test(prose),
        `${toxin.slug}: prose matches ${pattern} - this table never states an amount`
      );
    }
  }
});

test("no entry tells somebody to treat the animal themselves", () => {
  /**
   * Inducing vomiting is the specific folk remedy that does real harm with
   * corrosives and with batteries. The table is allowed to say *not* to - two
   * entries do, because it is the most useful sentence on the page - so the
   * check is per sentence, not per entry: a prohibition elsewhere in the
   * paragraph must not excuse an instruction here.
   */
  const INSTRUCTS =
    /(induce vomiting|make (him|her|them|it|your|the)[a-z ]*(vomit|sick)|give (him|her|them|it|your|the)[a-z ]*(peroxide|charcoal|milk|salt water|water to drink))/;
  const FORBIDS = /(do not|don't|is not to|never|avoid|advises against|rather than|without)/;

  for (const toxin of toxins.TOXINS) {
    for (const sentence of `${toxin.signs} ${toxin.guidance}`.toLowerCase().split(/(?<=[.;])\s+/)) {
      if (!INSTRUCTS.test(sentence)) continue;
      assert.ok(
        FORBIDS.test(sentence),
        `${toxin.slug}: "${sentence.trim()}" reads as an instruction to treat at home`
      );
    }
  }
});

test("a search finds the thing somebody would actually type", () => {
  const cases = [
    ["grape", "grapes-raisins"],
    ["raisins", "grapes-raisins"],
    ["Rat-Poison", "rodenticide"],
    ["sugar free gum", "xylitol"],
    ["chocolate", "chocolate"],
    ["coffee", "caffeine"],
    ["antifreeze", "antifreeze"],
    ["button battery", "button-batteries"],
    ["ibuprofen", "ibuprofen-nsaids"],
    ["easter lily", "lilies"],
  ];

  for (const [query, expected] of cases) {
    const found = toxins.search(query).map((t) => t.slug);
    assert.equal(found[0], expected, `"${query}" should find ${expected}, got ${found.join(",")}`);
  }
});

test("a generic alias never reaches out and claims a longer query", () => {
  /**
   * This is the bug that made the rule: "tea" is an alias of caffeine, so
   * "tea tree" came back as caffeine - the wrong species and the wrong organ.
   * A near-miss here is worse than no match, because the reader acts on it.
   */
  const first = toxins.search("tea tree").map((t) => t.slug);
  assert.equal(first[0], "essential-oils");
  assert.ok(!first.includes("caffeine"), "a bare 'tea' must not match 'tea tree'");

  assert.equal(toxins.search("tea tree oil")[0]?.slug, "essential-oils");
});

test("a miss is empty rather than approximately right", () => {
  assert.deepEqual(toxins.search("banana"), []);
  assert.deepEqual(toxins.search(""), []);
  assert.deepEqual(toxins.search("   "), []);
  assert.deepEqual(toxins.search(null), []);
});

test("results and the full list lead with what cannot wait", () => {
  const listed = toxins.all();
  assert.equal(listed.length, toxins.TOXINS.length);

  const ranks = listed.map((t) => toxins.SEVERITY_RANK[t.severity]);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "emergencies sort first");

  // And within a search: xylitol (emergency) before chocolate (call).
  const sweets = toxins.search("sugar");
  if (sweets.length > 1) {
    const seen = sweets.map((t) => toxins.SEVERITY_RANK[t.severity]);
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b));
  }
});

test("the entries most likely to be looked up are present and urgent", () => {
  // The ASPCA's own top categories, 2024 and 2025.
  const mustBeEmergency = ["xylitol", "grapes-raisins", "antifreeze", "rodenticide", "lilies"];
  for (const slug of mustBeEmergency) {
    const toxin = toxins.bySlug(slug);
    assert.ok(toxin, `${slug} is in the table`);
    assert.equal(toxin.severity, "emergency", `${slug} is not something to sleep on`);
  }

  assert.equal(toxins.bySlug("chocolate")?.severity, "call");
  assert.equal(toxins.bySlug("nope"), null);
});

test("the cat-specific dangers say so in their species list", () => {
  assert.deepEqual(toxins.bySlug("lilies").species, ["cat"]);
  assert.deepEqual(toxins.bySlug("permethrin-cats").species, ["cat"]);
  // And the dog-only one, which cats are not known to react to.
  assert.deepEqual(toxins.bySlug("grapes-raisins").species, ["dog"]);
});

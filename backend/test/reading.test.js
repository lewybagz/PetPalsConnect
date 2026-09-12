const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const harness = require("./helpers/harness");
const reading = require("../services/petCare/reading");

let Article;

/**
 * The reading shelf, and the species vocabulary bridge under it.
 *
 * Articles are tagged editorially (`dogs`, `small-pets`) and pets carry a
 * schema enum (`dog`, `smallMammal`). Nothing mapped between the two, so
 * "articles for your cat" was not expressible. `reading.js` is where that
 * translation lives, and the test that matters most is that every species a
 * pet can actually be resolves to a tag the corpus really uses - otherwise
 * the shelf is silently empty for somebody's rabbit and nothing says so.
 */
test.before(async () => {
  await harness.start();
  Article = require("../models/Article");
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

const makeArticle = (title, tags, publishedDate = new Date()) =>
  Article.create({
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    summary: `${title} summary`,
    content: `${title} body text.`,
    byline: "PetPals Connect",
    tags,
    publishedDate,
    sources: [{ title: "A source", publisher: "A publisher", url: "https://example.test" }],
  });

test("every species a pet can be maps to a tag the corpus actually uses", () => {
  /**
   * Reads the committed corpus rather than a fixture: the point is that the
   * mapping matches the articles that really exist. A species pointing at a
   * tag nothing carries is a shelf that is empty forever with nothing saying
   * why - the same failure mode as a topic chip with no articles behind it.
   */
  const corpus = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "content", "articles", "articles.json"),
      "utf8"
    )
  );
  const used = new Set(corpus.flatMap((article) => article.tags));

  // The Pet schema's own enum, which is what `forPet` is handed.
  const SPECIES = ["dog", "cat", "smallMammal", "bird", "reptile", "fish"];
  for (const species of SPECIES) {
    const tag = reading.tagForSpecies(species);
    assert.ok(tag, `${species} has a tag`);
    assert.ok(used.has(tag), `${species} maps to "${tag}", which the corpus carries`);
  }

  // And the life-stage tags, for the two species that have them.
  for (const [species, stages] of Object.entries(reading.STAGE_TAGS)) {
    for (const [stage, tag] of Object.entries(stages)) {
      assert.ok(used.has(tag), `${species}/${stage} maps to "${tag}", which the corpus carries`);
    }
  }
});

test("a pet gets articles for its own species", async () => {
  await makeArticle("Dog parks", ["dogs", "playdates"]);
  await makeArticle("Litter boxes", ["cats", "behaviour"]);

  const forCat = await reading.forPet({ species: "cat", age: 5 });
  assert.equal(forCat.length, 1);
  assert.equal(forCat[0].title, "Litter boxes");
});

test("a small mammal reaches the small-pets articles", async () => {
  await makeArticle("Bonding rabbits", ["small-pets", "rabbits"]);
  await makeArticle("Dog parks", ["dogs"]);

  const found = await reading.forPet({ species: "smallMammal", age: 2 });
  assert.deepEqual(
    found.map((a) => a.title),
    ["Bonding rabbits"]
  );
});

test("a puppy's articles lead with the puppy ones, then carry on", async () => {
  const old = new Date("2026-01-01");
  await makeArticle("General dog article A", ["dogs"], old);
  await makeArticle("General dog article B", ["dogs"], old);
  await makeArticle("Puppy socialisation", ["dogs", "puppies"], old);

  const found = await reading.forPet({ species: "dog", age: 0.5 });

  assert.equal(found[0].title, "Puppy socialisation", "the stage article is first");
  // But it does not filter to only puppy articles - one article is a thin shelf.
  assert.equal(found.length, 3);
});

test("an unknown age is not guessed at", async () => {
  await makeArticle("General dog article", ["dogs"]);
  await makeArticle("Puppy socialisation", ["dogs", "puppies"]);

  // No age: `lifeStage` returns null, so no stage is preferred and nothing
  // claims to know whether this is a puppy.
  const found = await reading.forPet({ species: "dog" });
  assert.equal(found.length, 2);
});

test("bodies never travel - a shelf renders three headlines", async () => {
  await makeArticle("Dog parks", ["dogs"]);

  const [article] = await reading.forPet({ species: "dog", age: 4 });
  assert.ok(article.title);
  assert.ok(article.summary);
  assert.equal(article.content, undefined, "the body is projected away");
});

test("no articles for a species is empty, not an error", async () => {
  await makeArticle("Dog parks", ["dogs"]);

  assert.deepEqual(await reading.forPet({ species: "fish", age: 1 }), []);
});

test("a shelf is capped so it stays a shelf", async () => {
  for (let i = 0; i < 8; i += 1) await makeArticle(`Dog article ${i}`, ["dogs"]);

  const found = await reading.forPet({ species: "dog", age: 4 });
  assert.equal(found.length, reading.ARTICLES_PER_PET);
});

test("several pets are answered in one go, keyed by pet", async () => {
  await makeArticle("Dog parks", ["dogs"]);
  await makeArticle("Litter boxes", ["cats"]);

  const shelves = await reading.forPets([
    { _id: "pet-dog", species: "dog", age: 4 },
    { _id: "pet-cat", species: "cat", age: 4 },
  ]);

  assert.equal(shelves.get("pet-dog")[0].title, "Dog parks");
  assert.equal(shelves.get("pet-cat")[0].title, "Litter boxes");
});

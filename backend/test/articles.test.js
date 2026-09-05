const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

const harness = require("./helpers/harness");

let app;
let Article;

const CORPUS = path.resolve(__dirname, "../../content/articles/articles.json");

/**
 * The editorial corpus, and the routes that serve it.
 *
 * `content/articles/articles.json` is seeded by
 * `data-fetch-scripts/articles/seedArticles.js`, which writes it through the
 * real `Article` model. That is the whole reason this file exists: a seeder is
 * a create path like any other, and this codebase has been bitten repeatedly by
 * create paths that could never satisfy their schema. Strict mode drops keys it
 * does not recognise, so an article carrying a field the schema lost would save
 * with that field silently missing, and the only place it would show is a blank
 * line on somebody's phone.
 *
 * The route fixes proved here were all field-name drift of the same family:
 *
 * - `getLatestArticles` sorted on `PublishedDate`, a path no document has, so
 *   "latest" was whatever order Mongo felt like returning.
 * - `searchArticles` queried `Title`. Not a path either, so search returned an
 *   empty list for every term anybody has ever typed.
 * - `createArticle` assigned `req.body.author ?? req.user?.username` to an
 *   ObjectId ref. `req.user` does not exist and a username is not an id.
 */
test.before(async () => {
  app = await harness.start();
  Article = require("../models/Content").Article;
});

test.after(async () => {
  await harness.stop();
});

test.beforeEach(async () => {
  await harness.clear();
});

/**
 * Every route in this app is mounted behind `authenticate`, articles included.
 * `PUBLIC_READS` in services/authAudit.js means the rows are the same for every
 * caller, not that the route is open.
 */
const auth = (uid = "reader-1") => [
  "Authorization",
  `Bearer ${harness.issueToken(uid)}`,
];

const corpus = () => JSON.parse(fs.readFileSync(CORPUS, "utf8"));

const seed = async () => {
  const articles = corpus();
  for (const { slug, ...fields } of articles) {
    await Article.create({ ...fields, slug, contentType: "Article" });
  }
  return articles;
};

test("every seeded article satisfies the Article schema", async () => {
  const articles = await seed();
  const stored = await Article.find();

  assert.equal(stored.length, articles.length);

  // Round-trips rather than trusting the insert: strict mode drops unknown
  // keys without complaining, so the check has to be that the field came back.
  for (const article of stored) {
    assert.ok(article.title, `${article.slug} lost its title`);
    assert.ok(article.content, `${article.slug} lost its content`);
    assert.ok(article.summary, `${article.slug} lost its summary`);
    assert.ok(article.byline, `${article.slug} lost its byline`);
    assert.ok(article.sources.length, `${article.slug} lost its sources`);
    assert.ok(article.tags.length, `${article.slug} lost its tags`);
    assert.ok(article.publishedDate instanceof Date);
  }
});

test("an article body carries no markdown, because the screen renders text", () => {
  // `ArticleDetailScreen` splits `content` on blank lines and renders each
  // paragraph into a `Text`. There is no markdown renderer anywhere in the app,
  // so "**" and "## " reach a device as literal characters.
  const offenders = [];
  for (const article of corpus()) {
    for (const token of ["**", "## ", "](", "\t"]) {
      if (article.content.includes(token)) {
        offenders.push(`${article.slug} contains ${JSON.stringify(token)}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("every article cites at least one https source", () => {
  const offenders = [];
  for (const article of corpus()) {
    if (!article.sources?.length) {
      offenders.push(`${article.slug} has no sources`);
      continue;
    }
    for (const source of article.sources) {
      if (!source.title || !source.publisher) {
        offenders.push(`${article.slug} has a source missing title or publisher`);
      }
      if (!source.url?.startsWith("https://")) {
        offenders.push(`${article.slug} cites a non-https url: ${source.url}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("slugs are unique, so the seeder's upsert cannot collide", () => {
  const slugs = corpus().map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("GET /api/articles/latest returns newest first", async () => {
  await seed();

  const response = await request(app).get("/api/articles/latest").set(...auth()).expect(200);

  assert.ok(response.body.length > 1);
  const dates = response.body.map((article) => new Date(article.publishedDate).valueOf());
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
});

test("GET /api/articles/latest returns the most recent article first", async () => {
  const articles = await seed();
  const newest = articles.reduce((latest, article) =>
    article.publishedDate > latest.publishedDate ? article : latest
  );

  const response = await request(app).get("/api/articles/latest").set(...auth()).expect(200);
  assert.equal(response.body[0].slug, newest.slug);
});

test("GET /api/articles/recent returns the single newest article", async () => {
  const articles = await seed();
  const newest = articles.reduce((latest, article) =>
    article.publishedDate > latest.publishedDate ? article : latest
  );

  const response = await request(app).get("/api/articles/recent").set(...auth()).expect(200);
  assert.equal(response.body.slug, newest.slug);
});

test("search finds an article by a word in its title", async () => {
  await seed();

  const response = await request(app)
    .get("/api/articles/search")
    .set(...auth())
    .query({ q: "microchip" })
    .expect(200);

  assert.ok(response.body.length >= 1);
  assert.ok(response.body.some((article) => article.slug === "microchips-and-registration"));
});

test("search matches tags as well as titles", async () => {
  await seed();

  const response = await request(app)
    .get("/api/articles/search")
    .set(...auth())
    .query({ q: "rabbits" })
    .expect(200);

  assert.ok(response.body.some((article) => article.slug === "rabbits-and-guinea-pigs"));
});

test("search treats the query as text, not as a regular expression", async () => {
  await seed();

  // ".*" matched everything before the pattern was escaped, and an unbalanced
  // "(" threw inside Mongo rather than returning nothing.
  const wildcard = await request(app)
    .get("/api/articles/search")
    .set(...auth())
    .query({ q: ".*" })
    .expect(200);
  assert.deepEqual(wildcard.body, []);

  const unbalanced = await request(app)
    .get("/api/articles/search")
    .set(...auth())
    .query({ q: "cats (" })
    .expect(200);
  assert.deepEqual(unbalanced.body, []);
});

test("an empty search does not return the whole collection", async () => {
  await seed();

  const response = await request(app)
    .get("/api/articles/search")
    .set(...auth())
    .query({ q: "" })
    .expect(200);

  assert.deepEqual(response.body, []);
});

test("GET /api/articles/:id returns one article with its sources", async () => {
  await seed();
  const seeded = await Article.findOne({ slug: "the-poison-list" });

  const response = await request(app)
    .get(`/api/articles/${seeded._id}`)
    .set(...auth())
    .expect(200);

  assert.equal(response.body.slug, "the-poison-list");
  assert.ok(response.body.sources.length);
  assert.ok(response.body.sources[0].url.startsWith("https://"));
});

test("an id-shaped route parameter that is not an id is a 404, not a schema dump", async () => {
  await request(app).get("/api/articles/not-an-id").set(...auth()).expect(404);
});

test("GET /api/articles/recent answers null rather than 404 on an empty shelf", async () => {
  const response = await request(app).get("/api/articles/recent").set(...auth()).expect(200);
  assert.equal(response.body, null);
});

test("createArticle takes the author from the token, not the body", async () => {
  const User = require("../models/User");
  const user = await User.create({
    firebaseUid: "author-1",
    email: "author-1@example.test",
    username: "author1",
    usernameLower: "author1",
  });
  const other = await User.create({
    firebaseUid: "other-1",
    email: "other-1@example.test",
    username: "other1",
    usernameLower: "other1",
  });

  const response = await request(app)
    .post("/api/articles")
    .set("Authorization", `Bearer ${harness.issueToken("author-1")}`)
    .send({
      title: "A post",
      content: "Body text.",
      // A client claiming somebody else wrote it.
      author: String(other._id),
      creator: String(other._id),
    })
    .expect(201);

  assert.equal(response.body.author, String(user._id));
  assert.equal(response.body.creator, String(user._id));
});

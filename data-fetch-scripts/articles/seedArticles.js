#!/usr/bin/env node
/**
 * Seeds the editorial articles from `content/articles/articles.json`.
 *
 * Run it from the repository root with the backend's dependencies installed:
 *
 *   node data-fetch-scripts/articles/seedArticles.js
 *   node data-fetch-scripts/articles/seedArticles.js --dry-run
 *   node data-fetch-scripts/articles/seedArticles.js --prune
 *
 * It is safe to run repeatedly. Each article is upserted on its `slug`, so
 * re-running after an edit updates the document in place rather than creating a
 * second copy - which matters because the articles get revised. `--prune`
 * additionally removes seeded articles whose slug has been deleted from the
 * JSON; without it, a removed article stays in the database.
 *
 * Two deliberate choices:
 *
 * **It requires the backend's own model** rather than declaring a schema here.
 * A seeder with its own copy of the schema is a second definition that drifts,
 * and the failure mode is silent: Mongoose's strict mode drops keys it does not
 * recognise, so a field renamed in the model would simply stop being written
 * with no error anywhere. `backend/test/schemaAudit.test.js` exists because
 * exactly that happened nine times in this codebase.
 *
 * **Mongoose comes from the model, not from a `require("mongoose")` here.**
 * Two copies of Mongoose in one process are two separate model registries, and
 * a model registered on one instance is invisible to a connection opened on the
 * other. Taking `Article.base` guarantees there is one.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const ARTICLES = path.join(ROOT, "content/articles/articles.json");

/**
 * Loaded lazily so `--dry-run` validates the JSON with no dependencies
 * installed and no database - which is what makes it usable as a content check
 * in CI, where the whole point is to fail before anything is deployed.
 */
const loadModel = () => {
  const { Article } = require(path.join(ROOT, "backend/models/Content"));
  // The model's own Mongoose instance. See the note above.
  return { Article, mongoose: Article.base };
};

/**
 * Reads `MONGODB_URI`, falling back to `backend/.env`.
 *
 * Parsed here rather than through dotenv so the script has no dependency of its
 * own to install and cannot pull in a second copy of anything.
 */
const readMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const envFile = path.join(ROOT, "backend/.env");
  if (!fs.existsSync(envFile)) return null;

  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*MONGODB_URI\s*=\s*(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
};

/** Fails loudly on anything the schema or the app cannot render. */
const validate = (articles) => {
  const problems = [];
  const seen = new Set();

  articles.forEach((article, index) => {
    const where = article.slug || `#${index}`;

    for (const field of ["slug", "title", "content", "summary"]) {
      if (!article[field]) problems.push(`${where}: missing ${field}`);
    }
    if (seen.has(article.slug)) problems.push(`${where}: duplicate slug`);
    seen.add(article.slug);

    // `ArticleDetailScreen` renders the body as plain text split on blank
    // lines. Markdown in `content` renders as literal asterisks and brackets on
    // a device, which no test would catch.
    for (const token of ["**", "##", "]("]) {
      if (article.content?.includes(token)) {
        problems.push(`${where}: body contains markdown ${JSON.stringify(token)}`);
      }
    }

    if (!article.sources?.length) {
      problems.push(`${where}: no sources - see content/research/standards.md`);
    }
    for (const source of article.sources ?? []) {
      if (!source.title || !source.publisher || !source.url) {
        problems.push(`${where}: a source is missing title, publisher or url`);
      } else if (!source.url.startsWith("https://")) {
        problems.push(`${where}: source url is not https: ${source.url}`);
      }
    }
  });

  return problems;
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const prune = process.argv.includes("--prune");

  const articles = JSON.parse(fs.readFileSync(ARTICLES, "utf8"));
  const problems = validate(articles);
  if (problems.length) {
    console.error(`${ARTICLES} is not seedable:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`${articles.length} articles validated.`);

  if (dryRun) {
    for (const article of articles) {
      console.log(`  would upsert ${article.slug} - ${article.title}`);
    }
    return null;
  }

  const { Article, mongoose } = loadModel();

  const uri = readMongoUri();
  if (!uri) {
    console.error(
      "No MONGODB_URI. Set it in the environment or in backend/.env " +
        "(see backend/.env.example)."
    );
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${uri.replace(/\/\/[^@]*@/, "//***@")}`);

  let created = 0;
  let updated = 0;

  for (const article of articles) {
    const { slug, ...fields } = article;
    const result = await Article.findOneAndUpdate(
      { slug, contentType: "Article" },
      {
        $set: {
          ...fields,
          slug,
          modifiedDate: new Date(),
        },
      },
      {
        upsert: true,
        runValidators: true,
        returnDocument: "after",
        // Mongoose 8 renamed `rawResult`. Without the metadata there is no way
        // to tell an insert from an update, and the run reported everything as
        // created every time - which would have made a re-seed look like it had
        // duplicated the whole corpus.
        includeResultMetadata: true,
      }
    );

    const isNew = !result.lastErrorObject?.updatedExisting;
    if (isNew) created += 1;
    else updated += 1;
    console.log(`  ${isNew ? "created" : "updated"} ${slug}`);
  }

  console.log(`\n${created} created, ${updated} updated.`);

  if (prune) {
    const keep = articles.map((article) => article.slug);
    // Only ever removes articles that carry a slug. An article written through
    // `POST /api/articles` has none, so a user's own post is never pruned by a
    // content deploy.
    const removed = await Article.deleteMany({
      contentType: "Article",
      slug: { $exists: true, $nin: keep },
    });
    console.log(`${removed.deletedCount} stale seeded articles removed.`);
  }

  return mongoose;
};

main()
  .then(async (mongoose) => {
    if (mongoose && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

const fs = require("node:fs");
const path = require("node:path");

/**
 * Checks that reads are scoped to the caller and writes take identity from the
 * token.
 *
 * Every route is mounted behind `authenticate`, which is easy to mistake for
 * authorisation. It is not: it proves you have *an* account, not that a row is
 * yours. Twenty list handlers were `Model.find()` with no filter, so any signed
 * -in user could read every private message, every notification, every user
 * record with its email, and every report of who had reported whom.
 *
 * Eleven create paths took `creator`, `sender`, `reporter` or `user` from the
 * request body, so a client could write as somebody else.
 *
 * Neither shows up in lint, types, or a passing test suite - the code reads
 * perfectly well. Like the schema audit next door, one static pass covers the
 * whole class, and an allowlist forces a deliberate decision rather than an
 * accidental one.
 */

const ROOT = path.resolve(__dirname, "..");

/**
 * Reads that are meant to be public, with the reason.
 *
 * Catalogue data: the same rows for everybody, holding nothing personal. Each
 * entry is a decision someone made on purpose - adding one should feel like
 * more work than scoping the query properly.
 */
const PUBLIC_READS = {
  "ArticleController.getAllArticles": "editorial content, the same for everyone",
  "ArticleController.getLatestArticles": "the articles list screen",
  "ArticleController.getLatestArticle": "the home screen's article shelf",
  "LocationController.getAllLocations": "the shared catalogue of parks and meeting places",
  "PotentialPlaydateLocationController.getAllLocations":
    "suggested meeting places, no personal data",
  "ServiceController.getAllServices": "a directory of vets and groomers",
  "PetController.getAllPets": "pets are the browsable content of the app",
  "PetController.getLatestPets": "the home screen's new-pets shelf",
  "UserController.getAllUsers": "a username search, projected to public fields only",
  "UserController.checkUsernameAvailability": "answers yes or no about one name",
};

/** Ways a handler can prove it scoped the query to the caller. */
const SCOPE_MARKERS = [
  "req.userId",
  "req.user._id",
  "req.user?._id",
  "req.params.userId",
  "req.params.id",
  "req.params.chatId",
  "req.params.petId",
  "req.params.playdateId",
  "req.params.groupId",
  "req.params.locationId",
  "req.params.otherPetId",
  "req.query.petId",
  "res.locals",
];

const controllerFiles = () =>
  fs
    .readdirSync(path.join(ROOT, "controllers"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(ROOT, "controllers", name));

/**
 * Splits a controller into its handlers.
 *
 * Method shorthand in an object literal, which is how every controller here is
 * written: `async getAllThings(req, res) { ... }`.
 */
const handlers = (source) => {
  const found = [];
  const pattern = /^\s{2}(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;

  for (const match of source.matchAll(pattern)) {
    const start = match.index + match[0].length - 1;

    let depth = 0;
    let end = start;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    found.push({
      name: match[1],
      body: source.slice(start, end + 1),
      line: source.slice(0, match.index).split("\n").length + 1,
    });
  }

  return found;
};

/** Handlers that read a collection without narrowing it to the caller. */
const unscopedReads = () => {
  const problems = [];

  for (const file of controllerFiles()) {
    const controller = path.basename(file, ".js");
    const source = fs.readFileSync(file, "utf8");

    for (const handler of handlers(source)) {
      const key = `${controller}.${handler.name}`;
      if (PUBLIC_READS[key]) continue;

      // `.find()` and `.find({})` return the whole collection.
      const wholeCollection = /\.find\(\s*(\{\s*\})?\s*\)/.test(handler.body);
      if (!wholeCollection) continue;

      const scoped = SCOPE_MARKERS.some((marker) => handler.body.includes(marker));
      if (scoped) continue;

      problems.push(
        `${path.relative(ROOT, file)}:${handler.line} ${handler.name} reads the ` +
          `whole collection - every row, for any signed-in user. Filter it by ` +
          `\`req.userId\`, or add it to PUBLIC_READS with a reason.`
      );
    }
  }

  return problems;
};

/**
 * Writes that let the request body say who the caller is.
 *
 * A body-supplied `creator` or `sender` is not a data bug - it is an identity
 * one. It lets a client post as anybody.
 */
const IDENTITY_FIELDS = [
  "creator",
  "sender",
  "reporter",
  "reviewer",
  "owner",
  "userId",
  "createdBy",
];

const bodyIdentityWrites = () => {
  const problems = [];

  for (const file of controllerFiles()) {
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      for (const field of IDENTITY_FIELDS) {
        // `creator: req.body.creator` - assigning identity from the body.
        const assigns = new RegExp(`\\b${field}\\s*:\\s*req\\.body\\.`);
        if (!assigns.test(line)) continue;

        problems.push(
          `${path.relative(ROOT, file)}:${index + 1} takes \`${field}\` from the ` +
            `request body, so a client can write as somebody else. Use \`req.userId\`.`
        );
      }
    });
  }

  return problems;
};

/** Everything both checks found, newest concern first. */
const audit = () => [...unscopedReads(), ...bodyIdentityWrites()];

module.exports = {
  audit,
  unscopedReads,
  bodyIdentityWrites,
  handlers,
  PUBLIC_READS,
};

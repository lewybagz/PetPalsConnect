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
  "ServiceController.getAllServices": "a directory of vets and groomers",
  "PetController.getAllPets": "pets are the browsable content of the app",
  "PetController.getLatestPets": "the home screen's new-pets shelf",
  "UserController.getAllUsers": "a username search, projected to public fields only",
  "UserController.checkUsernameAvailability": "answers yes or no about one name",
};

/**
 * Reads that deliberately cross users, and the guard that makes that safe.
 *
 * A moderation queue is the one list that has to show other people's rows. It
 * is safe only because its route carries `requireModerator`, and that guard is
 * one careless edit away from being dropped - at which point the handler still
 * reads perfectly well and every report in the database is public. So the
 * pairing is checked rather than trusted: the key names the handler, the value
 * names the middleware its route must carry.
 */
const GUARDED_READS = {
  "ReportController.getReportQueue": "requireModerator",
  "ReportController.updateReportStatus": "requireModerator",
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

/**
 * Every handler in `GUARDED_READS` is registered on a route that still carries
 * its guard.
 *
 * The handler is what a reviewer reads, and it looks fine on its own - the
 * whole reason it is safe lives in a different file, on one line, in the middle
 * of a router. Losing that line is a silent change from "moderators only" to
 * "anybody with an account".
 */
const unguardedReads = () => {
  const problems = [];
  const routeDir = path.join(ROOT, "routes");

  const sources = fs
    .readdirSync(routeDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => fs.readFileSync(path.join(routeDir, name), "utf8"))
    .join("\n");

  for (const [key, guard] of Object.entries(GUARDED_READS)) {
    const handler = key.split(".")[1];
    const registration = sources
      .split("\n")
      .find((line) => line.includes(`.${handler}`) && line.includes("router."));

    if (!registration) {
      problems.push(
        `${key} is allowlisted as a guarded read but no route registers it.`
      );
      continue;
    }
    if (!registration.includes(guard)) {
      problems.push(
        `${key} reads across users but its route no longer carries \`${guard}\`, ` +
          `so any signed-in account can call it.`
      );
    }
  }

  return problems;
};

/** Everything the checks found, newest concern first. */
const audit = () => [
  ...unscopedReads(),
  ...bodyIdentityWrites(),
  ...unguardedReads(),
];

module.exports = {
  audit,
  unscopedReads,
  bodyIdentityWrites,
  unguardedReads,
  handlers,
  PUBLIC_READS,
  GUARDED_READS,
};

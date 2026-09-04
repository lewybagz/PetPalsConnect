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

/**
 * Ways a handler can prove it scoped the query to the caller.
 *
 * `req.params.chatId`, `groupId` and `locationId` used to be on this list, and
 * that was the hole: a *resource* id names a row, it does not identify who is
 * asking for it. Five chat handlers and five group-chat handlers looked a
 * conversation up by the id in the URL and returned it, so any signed-in
 * account could read anybody's private messages - and the audit called them
 * scoped, which is worse than not having checked.
 *
 * What stays are the caller's own identity, and the params a route can only be
 * reached with after an ownership check in the same handler.
 */
const SCOPE_MARKERS = [
  "req.userId",
  "req.user._id",
  "req.user?._id",
  "req.params.userId",
  "req.params.id",
  "req.params.petId",
  "req.params.playdateId",
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
 * The controllers to audit, as `{ file, source }`.
 *
 * `overrides` maps a controller's basename to source text used in place of what
 * is on disk. That is how the suite proves the audit still catches a hole that
 * has been fixed: it hands over a mutated copy of a controller rather than
 * writing one to the working tree and restoring it in a `finally`.
 *
 * The write-and-restore version was a genuine hazard, not a style point. A run
 * interrupted between the two - Ctrl-C, a crash, a cancelled CI job - leaves a
 * deliberately broken controller committed-adjacent in the tree, and every run
 * after it fails somewhere else entirely, for a reason that looks like a real
 * bug. A test must not be able to damage the thing it is testing.
 */
const controllerSources = (overrides = {}) => {
  const seen = new Set();

  const fromDisk = controllerFiles().map((file) => {
    const name = path.basename(file);
    seen.add(name);
    return {
      file,
      source: Object.hasOwn(overrides, name)
        ? overrides[name]
        : fs.readFileSync(file, "utf8"),
    };
  });

  // An override naming a controller that does not exist is a typo in a test,
  // and silently auditing nothing would let it pass.
  for (const name of Object.keys(overrides)) {
    if (!seen.has(name)) {
      throw new Error(`No controller named ${name} to override`);
    }
  }

  return fromDisk;
};

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
const unscopedReads = (overrides) => {
  const problems = [];

  for (const { file, source } of controllerSources(overrides)) {
    const controller = path.basename(file, ".js");

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

const bodyIdentityWrites = (overrides) => {
  const problems = [];

  for (const { file, source } of controllerSources(overrides)) {
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

    // The same thing spelled differently: `const { sender } = req.body` and
    // then `new FriendRequest({ sender, ... })`. Shorthand hides the read, so
    // the line above matched nothing and a client could post as anybody. It
    // survived every review of that file for exactly that reason.
    for (const match of source.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*req\.body/g)) {
      const line = source.slice(0, match.index).split("\n").length;
      const names = match[1]
        .split(",")
        .map((part) => part.trim().split(":")[0].split("=")[0].trim())
        .filter(Boolean);

      for (const name of names) {
        if (!IDENTITY_FIELDS.includes(name)) continue;
        problems.push(
          `${path.relative(ROOT, file)}:${line} destructures \`${name}\` out of ` +
            `the request body. Identity comes from the token - use \`req.userId\`.`
        );
      }
    }
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

/**
 * Fields that say *whose* a row is, however the query spells it.
 *
 * Wider than `IDENTITY_FIELDS`, which is about writes: a query can be scoped on
 * a field a create path never sets by hand.
 */
const OWNERSHIP_FIELDS = [
  "user",
  "userId",
  "owner",
  "creator",
  "relevantToUser",
  "recipient",
  "sender",
  "reporter",
  "participants",
  "members",
];

/**
 * Queries scoped on an owner the *request* named.
 *
 * `unscopedReads` only looks for `.find()` with no filter, so a query that has
 * a filter passes - including `PetMatch.find({ relevantToUser: req.params.userId })`,
 * which is every match belonging to whoever's id you put in the URL. It reads
 * like a scoped query and audited like one; it is an open door with a filter on
 * it. `explainMatch` and `getPetMatchById` were the same shape by a different
 * route, so this is a class, not an instance.
 *
 * An ownership field takes its value from the token. If a handler genuinely
 * needs to name another user, it belongs in `GUARDED_READS` behind a guard.
 */
const requestSuppliedOwners = (overrides) => {
  const problems = [];

  for (const { file, source } of controllerSources(overrides)) {
    source.split("\n").forEach((line, index) => {
      for (const field of OWNERSHIP_FIELDS) {
        const assigns = new RegExp(
          `\\b${field}\\s*:\\s*(?:String\\()?req\\.(params|body|query)\\.`
        );
        const match = line.match(assigns);
        if (!match) continue;

        problems.push(
          `${path.relative(ROOT, file)}:${index + 1} scopes a query on ` +
            `\`${field}\` taken from \`req.${match[1]}\`, so the caller chooses ` +
            `whose rows to read. Use \`req.userId\`.`
        );
      }
    });
  }

  return problems;
};

/** Everything the checks found, newest concern first. */
const audit = () => [
  ...unscopedReads(),
  ...requestSuppliedOwners(),
  ...bodyIdentityWrites(),
  ...unguardedReads(),
];

module.exports = {
  audit,
  controllerSources,
  unscopedReads,
  requestSuppliedOwners,
  bodyIdentityWrites,
  unguardedReads,
  handlers,
  PUBLIC_READS,
  GUARDED_READS,
};

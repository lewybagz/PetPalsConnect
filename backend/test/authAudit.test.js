const test = require("node:test");
const assert = require("node:assert/strict");

const {
  audit,
  unscopedReads,
  requestSuppliedOwners,
  bodyIdentityWrites,
  handlers,
  PUBLIC_READS,
} = require("../services/authAudit");

/**
 * The guard against "authenticated" being mistaken for "authorised".
 *
 * Every route sits behind `authenticate`, which proves you have an account and
 * nothing more. Twenty list handlers were `Model.find()` with no filter, so any
 * signed-in user could read:
 *
 *   /api/messages        every private message, both parties populated
 *   /api/notifications   everyone's notifications
 *   /api/users           every account, emails and Firebase uids included
 *   /api/reports         who had reported whom, and why
 *   /api/blocklists      who had blocked whom
 *   /api/friends         every friendship - and the friends screen showed them
 *   /api/friendrequests  everyone's pending requests
 *
 * and eleven create paths took `creator`, `sender`, `reporter` or `user` from
 * the request body, so a client could write as anybody.
 *
 * None of it is visible to lint, types or a green test suite: the code reads
 * exactly as intended. This is the check that makes the next one loud.
 */

test("no handler reads a whole collection unscoped", () => {
  const problems = unscopedReads();

  assert.deepEqual(
    problems,
    [],
    `these return every row to any signed-in user:\n  ${problems.join("\n  ")}`
  );
});

test("no create path takes identity from the request body", () => {
  const problems = bodyIdentityWrites();

  assert.deepEqual(
    problems,
    [],
    `these let a client write as somebody else:\n  ${problems.join("\n  ")}`
  );
});

test("the audit parses handlers, so it cannot pass vacuously", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  const source = fs.readFileSync(
    path.resolve(__dirname, "../controllers/UserController.js"),
    "utf8"
  );
  const found = handlers(source);

  assert.ok(found.length > 5, `expected several handlers, found ${found.length}`);
  assert.ok(
    found.some((handler) => handler.name === "getAllUsers"),
    "the parser stopped recognising controller methods"
  );

  // A handler's body must actually be its body, or the scope check reads the
  // wrong text and every finding is meaningless.
  const getAllUsers = found.find((handler) => handler.name === "getAllUsers");
  assert.ok(getAllUsers.body.includes("usernameLower"));
  assert.ok(!getAllUsers.body.includes("getUserById"));
});

test("every public read is a decision with a reason attached", () => {
  assert.ok(Object.keys(PUBLIC_READS).length > 0);

  for (const [handler, reason] of Object.entries(PUBLIC_READS)) {
    assert.match(handler, /^\w+Controller\.\w+$/, `${handler} is not Controller.handler`);
    assert.ok(
      reason && reason.length > 15,
      `${handler} is allowlisted without a real reason`
    );
  }
});

test("an unscoped read is caught wherever it appears", () => {
  // The allowlist is by handler name, so a new unfiltered read in an
  // allowlisted controller is still reported.
  const problems = audit();
  assert.deepEqual(problems, []);

  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.resolve(__dirname, "../controllers/ReviewController.js");
  const original = fs.readFileSync(file, "utf8");

  try {
    fs.writeFileSync(
      file,
      original.replace(
        "const reviews = await Review.find({ reviewer: req.userId })",
        "const reviews = await Review.find()"
      )
    );

    const reintroduced = unscopedReads();
    assert.ok(
      reintroduced.some((problem) => problem.includes("getAllReviews")),
      "the audit did not catch a reintroduced unscoped read"
    );
  } finally {
    fs.writeFileSync(file, original);
  }
});

/**
 * A filter is not a scope.
 *
 * `unscopedReads` only looks for `.find()` with nothing in it, so a query with
 * a filter passed however that filter was built - including
 * `PetMatch.find({ relevantToUser: req.params.userId })`, which is every match
 * belonging to whoever's id is in the URL. It read like a scoped query and
 * audited like one. Two more handlers had the same shape by a different route,
 * so this is a class of hole rather than one mistake.
 */
test("a query scoped on an owner the caller named is caught", () => {
  assert.deepEqual(requestSuppliedOwners(), []);

  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.resolve(__dirname, "../controllers/PetMatchController.js");
  const original = fs.readFileSync(file, "utf8");

  try {
    fs.writeFileSync(
      file,
      original.replace(
        "PetMatch.find({ relevantToUser: req.userId })",
        "PetMatch.find({ relevantToUser: req.params.userId })"
      )
    );

    const problems = requestSuppliedOwners();
    assert.ok(
      problems.some((problem) => problem.includes("relevantToUser")),
      "the audit did not catch a query scoped on an id from the URL"
    );
  } finally {
    fs.writeFileSync(file, original);
  }
});

test("it looks at the body and the query string too, not only params", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.resolve(__dirname, "../controllers/PetMatchController.js");
  const original = fs.readFileSync(file, "utf8");

  for (const source of ["req.body.userId", "req.query.userId"]) {
    try {
      fs.writeFileSync(
        file,
        original.replace(
          "PetMatch.find({ relevantToUser: req.userId })",
          `PetMatch.find({ relevantToUser: ${source} })`
        )
      );

      assert.ok(
        requestSuppliedOwners().length > 0,
        `the audit missed an owner taken from ${source}`
      );
    } finally {
      fs.writeFileSync(file, original);
    }
  }
});

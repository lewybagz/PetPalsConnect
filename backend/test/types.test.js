const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

/**
 * Keeps the app's TypeScript types honest against the Mongoose schemas.
 *
 * The app is being converted to TypeScript a module at a time, and
 * `PetPalsConnectApp/src/types/api.ts` describes what the API returns. Nothing
 * generates it - there is no OpenAPI document - so it is a second, hand-written
 * copy of the schema, and a second copy drifts.
 *
 * This reads the interfaces out of that file and checks every field against the
 * real schema paths. It matters because a wrong field name is invisible
 * everywhere else: TypeScript is happy (the type is the only authority it has),
 * the bundle builds, and the screen renders a blank line on a device. That is
 * exactly how the subscription screens shipped reading `subscription.PlanType`
 * off a document whose field is `planType`, and how the first draft of
 * `api.ts` invented `fullName`, `bio`, `profilePhotoUrl` and `gender`.
 *
 * The app-to-API route contract lives next door in `contract.test.js`; this is
 * the same idea applied to payloads instead of paths.
 */

const TYPES_FILE = path.resolve(
  __dirname,
  "../../PetPalsConnectApp/src/types/api.ts"
);

/** Interfaces here describe a Mongo document, and the model they map to. */
const DOCUMENT_INTERFACES = { Pet: "Pet", User: "User", Subscription: "Subscription" };

/** Fields that exist on the JSON but not as schema paths. */
const SYNTHETIC = new Set(["_id"]);

require("../models/User");
require("../models/Pet");
require("../models/Subscription");

/** Extracts `interface Name { ... }` bodies, ignoring comments. */
const readInterfaces = () => {
  const source = fs
    .readFileSync(TYPES_FILE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const interfaces = new Map();
  for (const match of source.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
    const fields = [...match[2].matchAll(/^\s*(\w+)(\??):/gm)].map((field) => ({
      name: field[1],
      optional: field[2] === "?",
    }));
    interfaces.set(match[1], fields);
  }
  return interfaces;
};

test("the app's types name fields that exist on the schema", () => {
  const interfaces = readInterfaces();
  const unknown = [];

  for (const [interfaceName, modelName] of Object.entries(DOCUMENT_INTERFACES)) {
    const fields = interfaces.get(interfaceName);
    assert.ok(fields?.length, `no "${interfaceName}" interface found in api.ts`);

    const schema = mongoose.model(modelName).schema;
    for (const field of fields) {
      if (SYNTHETIC.has(field.name)) continue;
      if (!schema.path(field.name)) {
        unknown.push(`${interfaceName}.${field.name} is not a path on ${modelName}`);
      }
    }
  }

  assert.deepEqual(
    unknown,
    [],
    `app types describe fields the schema does not have:\n  ${unknown.join("\n  ")}`
  );
});

test("a field the schema does not require is optional in the app's types", () => {
  const interfaces = readInterfaces();
  const overclaimed = [];

  for (const [interfaceName, modelName] of Object.entries(DOCUMENT_INTERFACES)) {
    const schema = mongoose.model(modelName).schema;

    for (const field of interfaces.get(interfaceName) ?? []) {
      if (field.optional || SYNTHETIC.has(field.name)) continue;

      const schemaPath = schema.path(field.name);
      // A default means the value is always present on a saved document.
      const guaranteed =
        schemaPath?.isRequired || schemaPath?.options?.default !== undefined;

      if (!guaranteed) {
        overclaimed.push(
          `${interfaceName}.${field.name} is required in the app, but ` +
            `${modelName} neither requires it nor defaults it`
        );
      }
    }
  }

  assert.deepEqual(
    overclaimed,
    [],
    `app types promise more than the schema:\n  ${overclaimed.join("\n  ")}`
  );
});

test("the subscription status union matches the schema's enum exactly", () => {
  const source = fs.readFileSync(TYPES_FILE, "utf8");
  const union = source.slice(
    source.indexOf("export type SubscriptionStatus"),
    source.indexOf(";", source.indexOf("export type SubscriptionStatus"))
  );

  const declared = [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort();
  const schemaEnum = [...mongoose.model("Subscription").schema.path("status").enumValues].sort();

  // Stripe owns these values; a status in one list and not the other means the
  // app cannot describe a state a subscription can actually be in.
  assert.deepEqual(declared, schemaEnum);
});

test("the session states match the ones the gate can report", () => {
  const source = fs.readFileSync(TYPES_FILE, "utf8");
  const union = source.slice(
    source.indexOf("export type SessionState"),
    source.indexOf(";", source.indexOf("export type SessionState"))
  );
  const declared = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1]);

  const context = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/context/AuthSessionContext.js"),
    "utf8"
  );

  for (const state of declared) {
    assert.ok(
      context.includes(`"${state}"`),
      `api.ts declares session state "${state}" but AuthSessionContext never sets it`
    );
  }
});

/**
 * Field-name drift, the read side.
 *
 * The schemas are lowercase, but screens all over the app read PascalCase
 * versions of real field names: `item.ContentText` for a chat message,
 * `playdate.Date`/`.Location`/`.Notes`, `item.Content` for a notification,
 * `article.Title`/`.Content`/`.PublishedDate`, `subscription.PlanType`. Every
 * one of them evaluates to `undefined`: the screen renders a blank line, or
 * throws when something calls `.substring` on it. Nothing else catches this -
 * it is valid JavaScript, it bundles, and only a device shows you the gap.
 */
test("no screen reads a PascalCase version of a real schema field", () => {
  const mongoose = require("mongoose");
  for (const name of ["User", "Pet", "Subscription", "Notification", "Message", "Playdate", "Article", "Chat"]) {
    require(`../models/${name}`);
  }

  // Every top-level path any model declares, minus Mongo's own.
  const schemaFields = new Set();
  for (const model of Object.values(mongoose.models)) {
    for (const path of Object.keys(model.schema.paths)) {
      if (path.startsWith("_") || path === "__v") continue;
      schemaFields.add(path.split(".")[0]);
    }
  }

  const APP_SRC = path.resolve(__dirname, "../../PetPalsConnectApp/src");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
    }
  };
  walk(APP_SRC);

  const offenders = [];
  for (const file of files) {
    const source = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const match of source.matchAll(/\.([A-Z][a-zA-Z]*)\b/g)) {
      const lower = match[1][0].toLowerCase() + match[1].slice(1);
      if (schemaFields.has(lower)) {
        offenders.push(
          `${path.relative(APP_SRC, file)} reads .${match[1]}; the schema field is .${lower}`
        );
      }
    }
  }

  assert.deepEqual(
    [...new Set(offenders)],
    [],
    `screens reading PascalCase field names:\n  ${offenders.join("\n  ")}`
  );
});

/**
 * The app duplicates the matching weights so it can turn the server's
 * breakdown (in weighted points) back into per-dimension ratios for the
 * "why you matched" lines on a discovery card. A copy drifts; this is the
 * same guard the rest of this file applies to field names.
 */
test("the app's copy of the matching weights matches the algorithm", () => {
  const { WEIGHTS } = require("../services/matching/score");

  const source = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/api/discovery.js"),
    "utf8"
  );
  const block = source.slice(
    source.indexOf("export const MATCH_WEIGHTS"),
    source.indexOf("}", source.indexOf("export const MATCH_WEIGHTS"))
  );

  const appWeights = Object.fromEntries(
    [...block.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])])
  );

  assert.deepEqual(appWeights, WEIGHTS);
});

test("the app's notification types match the server's, entry for entry", () => {
  const backend = require("../services/notificationTypes");
  const appSource = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/api/notifications.js"),
    "utf8"
  );

  // The table decides which screen a tap opens. Two copies that drift produce
  // exactly the bug this replaced: the same event routing one way from a lock
  // screen and somewhere else - or nowhere - from the list.
  const table = appSource.slice(
    appSource.indexOf("export const TYPES"),
    appSource.indexOf("};", appSource.indexOf("export const TYPES"))
  );

  const appEntries = new Map(
    [...table.matchAll(/(\w+):\s*\{\s*screen:\s*"(\w+)",\s*param:\s*(?:"(\w+)"|null)/g)].map(
      (match) => [match[1], { screen: match[2], param: match[3] ?? null }]
    )
  );

  assert.deepEqual(
    [...appEntries.keys()].sort(),
    Object.keys(backend.TYPES).sort(),
    "the app and the server disagree about which notification types exist"
  );

  for (const [name, entry] of Object.entries(backend.TYPES)) {
    assert.deepEqual(
      appEntries.get(name),
      { screen: entry.screen, param: entry.param },
      `notification type "${name}" routes differently on the two sides`
    );
  }

  // The legacy table exists so rows written before this one keep routing; it
  // has to hold on both sides or an upgrade empties somebody's list.
  for (const [legacy, canonical] of Object.entries(backend.LEGACY)) {
    assert.ok(
      appSource.includes(`"${legacy}": "${canonical}"`) ||
        appSource.includes(`${legacy}: "${canonical}"`),
      `the app does not map the stored value "${legacy}" to "${canonical}"`
    );
  }
});

test("every notification destination is a screen the app registers", () => {
  const backend = require("../services/notificationTypes");
  const stack = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/screens/navigation/AppStack.js"),
    "utf8"
  );
  const tabs = fs.readFileSync(
    path.resolve(__dirname, "../../PetPalsConnectApp/src/screens/navigation/BottomTab.js"),
    "utf8"
  );

  for (const [name, entry] of Object.entries(backend.TYPES)) {
    assert.ok(
      stack.includes(`name="${entry.screen}"`) || tabs.includes(`name="${entry.screen}"`),
      `notification "${name}" routes to "${entry.screen}", which is not registered`
    );
  }
});

test("no screen writes a PascalCase version of a real schema field", () => {
  const mongoose = require("mongoose");
  for (const name of fs.readdirSync(path.resolve(__dirname, "../models"))) {
    if (name.endsWith(".js")) require(`../models/${name}`);
  }

  const schemaFields = new Set();
  for (const model of Object.values(mongoose.models)) {
    for (const modelPath of Object.keys(model.schema.paths)) {
      if (modelPath.startsWith("_") || modelPath === "__v") continue;
      schemaFields.add(modelPath.split(".")[0]);
    }
  }

  const APP_SRC = path.resolve(__dirname, "../../PetPalsConnectApp/src");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
    }
  };
  walk(APP_SRC);

  /**
   * The mirror image of the read check above, and the half that bites hardest.
   *
   * A PascalCase *read* renders a blank line. A PascalCase *write* is dropped
   * by Mongoose strict mode without an error, so the save then fails on the
   * required fields that look present in the source - or, worse, succeeds and
   * stores nothing. `PostPlaydateReviewScreen` sent
   * `{ Comment, Rating, RelatedPlaydate, Reviewer, Visibility }`, so no review
   * has ever been submitted; `GroupChatCreationScreen` sent
   * `{ GroupName, Participants, Creator }`; three safety payloads did the same
   * before them.
   *
   * Only object-literal keys count - `Comment: comment` - so a component prop
   * or a JSX attribute is not mistaken for a payload field.
   */
  const offenders = [];
  for (const file of files) {
    // Route names are PascalCase by convention, so the navigators are full of
    // keys that look like payload fields and are not.
    if (file.includes(`${path.sep}navigation${path.sep}`)) continue;

    const source = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // A payload is only a payload if the file talks to the API at all.
    if (!/\bapi\.(post|put|patch)\b/.test(source)) continue;

    for (const match of source.matchAll(/(^|[{,]\s*)([A-Z][a-zA-Z]*)\s*:/gm)) {
      const lower = match[2][0].toLowerCase() + match[2].slice(1);
      if (schemaFields.has(lower)) {
        offenders.push(
          `${path.relative(APP_SRC, file)} writes ${match[2]}:; the schema field is ${lower}`
        );
      }
    }
  }

  assert.deepEqual(
    [...new Set(offenders)],
    [],
    `payloads with PascalCase keys the schema drops:\n  ${[...new Set(offenders)].join("\n  ")}`
  );
});

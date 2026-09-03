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

const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

/**
 * Checks that every place we create a document can actually satisfy its schema.
 *
 * Three features of this app were dead for exactly this reason, and all three
 * failed quietly:
 *
 * - `Notification` requires `content`, `recipient` and `type`, and the one
 *   function that wrote notifications set `Content`, `Recipient` and `Type`.
 *   Strict mode drops unknown keys, so the document was empty and validation
 *   rejected it - inside a `.catch()` that only warned. No notification the
 *   app has ever raised reached anybody.
 * - `Favorite` requires `pet`, and `createFavorite` never set it. Every
 *   favourite returned 400.
 * - `Playdate` requires `startTime`, and `createPlaydate` never set it. Nobody
 *   could ever schedule a playdate.
 *
 * Each was invisible from the outside: the code reads fine, it lints, it
 * bundles, and the failure only shows up as a request that does nothing. One
 * static comparison catches the whole class.
 *
 * This is deliberately a *source* check rather than a runtime one. Waiting for
 * a request to exercise the path is what let these live for months.
 */

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["controllers", "services"];

/** Loads every model so `mongoose.models` is complete. */
const loadModels = () => {
  for (const file of fs.readdirSync(path.join(ROOT, "models"))) {
    if (file.endsWith(".js")) require(path.join(ROOT, "models", file));
  }
  return mongoose.models;
};

/**
 * The paths a document cannot be saved without.
 *
 * A path with a default is always present, so it does not need a call site to
 * set it. Discriminator keys are Mongoose's own.
 */
const requiredPaths = (model) => {
  const required = [];

  model.schema.eachPath((pathName, schemaType) => {
    if (pathName.startsWith("_") || pathName === "__v") return;
    if (pathName === model.schema.options.discriminatorKey) return;
    if (!schemaType.isRequired) return;
    if (schemaType.options?.default !== undefined) return;

    // A function-valued `required` depends on the document - Media's
    // `thumbnail` is required only when the type is "video". Whether a call
    // site satisfies that cannot be decided from the source, and guessing
    // would report a bug that is not there.
    if (typeof schemaType.options?.required === "function") return;

    required.push(pathName);
  });

  return required;
};

/**
 * Fields a model's own hooks fill in, which a call site therefore need not.
 *
 * `Pet` is a discriminator of `Content` and inherits a required `title`; a
 * pre-validate hook derives it from the pet's name. Reading the hooks rather
 * than hardcoding an exception means a hook that is deleted stops excusing the
 * field it used to set.
 */
const hookAssignedFields = (model) => {
  const assigned = new Set();

  // A discriminator inherits its base's required paths, and the hook that
  // fills one in usually lives with the base - `title` is required by
  // `Content` and derived from the pet's name in models/Content.js.
  const names = [model.modelName, model.baseModelName].filter(Boolean);

  for (const name of names) {
    const file = path.join(ROOT, "models", `${name}.js`);
    if (!fs.existsSync(file)) continue;

    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/this\.(\w+)\s*=[^=]/g)) assigned.add(match[1]);
  }

  return assigned;
};

/** Reads a balanced `{...}` starting at `open`, respecting strings. */
const balancedObject = (source, open) => {
  let depth = 0;
  let quote = null;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
};

/**
 * The keys an object literal sets, including shorthand.
 *
 * `{ content, recipient: id }` sets both `content` and `recipient`; a parser
 * that only looks for `key:` sees one of them and reports the other missing,
 * which would bury the real findings in noise.
 */
const topLevelKeys = (objectSource) => {
  const body = objectSource.slice(1, -1);
  const keys = [];

  let i = 0;
  let expectingKey = true;

  const skipWhitespaceAndComments = () => {
    for (;;) {
      while (i < body.length && /\s/.test(body[i])) i += 1;
      if (body.startsWith("//", i)) {
        while (i < body.length && body[i] !== "\n") i += 1;
        continue;
      }
      if (body.startsWith("/*", i)) {
        const close = body.indexOf("*/", i);
        i = close === -1 ? body.length : close + 2;
        continue;
      }
      return;
    }
  };

  /** Advances past one value, stopping at the comma that ends it. */
  const skipValue = () => {
    let depth = 0;
    let quote = null;

    while (i < body.length) {
      const char = body[i];

      if (quote) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === "`") {
        quote = char;
      } else if ("{[(".includes(char)) {
        depth += 1;
      } else if ("}])".includes(char)) {
        depth -= 1;
      } else if (char === "," && depth === 0) {
        i += 1;
        return;
      }
      i += 1;
    }
  };

  while (i < body.length) {
    skipWhitespaceAndComments();
    if (i >= body.length) break;

    if (!expectingKey) {
      skipValue();
      expectingKey = true;
      continue;
    }

    // A quoted key: { "content": ... }
    let key = "";
    if (body[i] === '"' || body[i] === "'") {
      const quote = body[i];
      i += 1;
      while (i < body.length && body[i] !== quote) {
        key += body[i];
        i += 1;
      }
      i += 1;
    } else {
      while (i < body.length && /[\w$]/.test(body[i])) {
        key += body[i];
        i += 1;
      }
    }

    if (!key) {
      // A spread, a computed key, or something else we do not model.
      skipValue();
      continue;
    }

    skipWhitespaceAndComments();

    if (body[i] === ":") {
      keys.push(key);
      i += 1;
      expectingKey = false;
      continue;
    }

    // Shorthand: `{ content, type }`.
    keys.push(key);
    if (body[i] === ",") i += 1;
  }

  return keys;
};

/** True when the literal spreads something we cannot resolve statically. */
const hasSpread = (objectSource) => /\.\.\./.test(objectSource);

/**
 * Every document-creating call site, with the fields it sets.
 *
 * Covers `new Model({...})`, `Model.create({...})` and the upsert form
 * `Model.findOneAndUpdate(filter, { $set, $setOnInsert }, { upsert: true })`,
 * where the filter's fields are also written on insert.
 */
const findCreateSites = (models) => {
  const sites = [];

  for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;

    for (const entry of fs.readdirSync(full, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

      const file = path.join(entry.parentPath ?? entry.path ?? full, entry.name);
      const source = fs.readFileSync(file, "utf8");
      const relative = path.relative(ROOT, file);

      const record = (modelName, index, fields, kind) => {
        const line = source.slice(0, index).split("\n").length;
        sites.push({ file: relative, line, modelName, fields, kind });
      };

      // new Model({...}) and Model.create({...})
      const pattern = /(?:new\s+(\w+)\s*\(|\b(\w+)\.create\s*\(\s*)/g;
      for (const match of source.matchAll(pattern)) {
        const modelName = match[1] ?? match[2];
        if (!models[modelName]) continue;

        const open = source.indexOf("{", match.index + match[0].length - 1);
        const argStart = match.index + match[0].length;
        // `Model.create(petsArray)` or `new Model(data)` - nothing to read.
        if (open === -1 || source.slice(argStart, open).trim() !== "") continue;

        const literal = balancedObject(source, open);
        if (!literal || hasSpread(literal)) continue;

        record(modelName, match.index, topLevelKeys(literal), "create");
      }

      // Model.findOneAndUpdate(filter, update, { upsert: true })
      for (const match of source.matchAll(/\b(\w+)\.findOneAndUpdate\s*\(/g)) {
        const modelName = match[1];
        if (!models[modelName]) continue;

        const callStart = match.index + match[0].length;
        const filterOpen = source.indexOf("{", callStart);
        const filter = balancedObject(source, filterOpen);
        if (!filter) continue;

        const updateOpen = source.indexOf("{", filterOpen + filter.length);
        const update = balancedObject(source, updateOpen);
        if (!update) continue;

        // Only an upsert can create a document.
        const tail = source.slice(updateOpen + update.length, updateOpen + update.length + 120);
        if (!/upsert:\s*true/.test(tail)) continue;
        if (hasSpread(filter) || hasSpread(update)) continue;

        const fields = [...topLevelKeys(filter)];
        let readable = true;

        for (const operator of ["$set", "$setOnInsert"]) {
          const at = update.indexOf(operator);
          if (at === -1) continue;

          // `$set: update` hands us a variable. Reading the *next* literal
          // would silently attribute some other operator's keys to this one,
          // so the honest answer is that this site cannot be checked.
          const after = update.slice(at + operator.length).replace(/^\s*:\s*/, "");
          if (!after.startsWith("{")) {
            readable = false;
            break;
          }

          const body = balancedObject(update, update.indexOf("{", at));
          if (body) fields.push(...topLevelKeys(body));
        }

        if (readable) record(modelName, match.index, fields, "upsert");
      }
    }
  }

  return sites;
};

/**
 * Every create site that cannot satisfy its model, as readable strings.
 * Empty means every document the code writes can actually be saved.
 */
const audit = () => {
  const models = loadModels();
  const problems = [];

  for (const site of findCreateSites(models)) {
    const model = models[site.modelName];
    const hookFilled = hookAssignedFields(model);
    const provided = new Set(site.fields);

    const missing = requiredPaths(model).filter(
      (pathName) => !provided.has(pathName) && !hookFilled.has(pathName)
    );

    if (missing.length > 0) {
      problems.push(
        `${site.file}:${site.line} ${site.kind}s a ${site.modelName} without ` +
          `${missing.map((name) => `\`${name}\``).join(", ")} ` +
          `(required by the schema, and nothing defaults or derives it)`
      );
    }
  }

  return problems;
};

module.exports = { audit, findCreateSites, requiredPaths, loadModels };

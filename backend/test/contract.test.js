const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Guards the app-to-API contract.
 *
 * The app once called 22 endpoints the backend did not serve: routers repeated
 * their own mount prefix ("/api/users/users/pets/:id"), some used a singular
 * "/api/user/..." segment, and several static paths were registered after
 * "/:id" so they were unreachable. None of that shows up at build time - the
 * app compiles fine and fails at runtime with a 404.
 *
 * These tests read both sides of the boundary from source and compare them, so
 * the same drift cannot come back unnoticed.
 */

const REPO = path.resolve(__dirname, "../..");
const BACKEND = path.join(REPO, "backend");
const APP = path.join(REPO, "PetPalsConnectApp");

const readMounts = () => {
  const server = fs.readFileSync(path.join(BACKEND, "Server.js"), "utf8");
  const start = server.indexOf("const routes = {");
  const block = server.slice(start, server.indexOf("};", start));

  const mounts = {};
  for (const m of block.matchAll(/["']?([a-zA-Z-]+)["']?:\s*["'](\w+)["']/g)) {
    mounts[`/api/${m[1]}`] = m[2];
  }
  return mounts;
};

const readServedRoutes = () => {
  const served = [];
  for (const [mount, moduleName] of Object.entries(readMounts())) {
    const file = path.join(BACKEND, "routes", `${moduleName}.js`);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']/g)) {
      served.push({
        method: m[1].toUpperCase(),
        path: (mount + m[2]).replace(/\/$/, "") || mount,
        file: `routes/${moduleName}.js`,
        order: served.length,
      });
    }
  }
  return served;
};

const appSourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".expo", "dist", "ios", "android"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // .ts/.tsx too: the app is being converted a module at a time, and a
      // converted file must not fall out of this check.
      else if (/\.[jt]sx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(APP);
  return out;
};

const readAppCalls = () => {
  const calls = new Map();
  for (const file of appSourceFiles()) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/api\.(get|post|put|patch|delete)\(\s*[`"']([^`"']+)[`"']/g)) {
      // The query string is stripped before comparison. Left on, a call to
      // "/api/articles/search?q=${term}" is three segments ending in
      // "search?q=:param", which fails to match "/api/articles/search" and
      // then *succeeds* against "/api/articles/:id" - because a ":id" segment
      // absorbs anything. A typo'd path could ride through the check that way.
      const normalised = m[2]
        .replace(/\$\{[^}]+\}/g, ":param")
        .replace(/\?.*$/, "")
        .replace(/\/$/, "");
      const key = `${m[1].toUpperCase()} ${normalised}`;
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(path.relative(APP, file));
    }
  }
  return calls;
};

/**
 * A call matches a route when segment counts line up and params absorb values.
 *
 * A `:param` slot absorbs only an *interpolated* segment - one the app built
 * from a `${...}` expression, normalised to ":param" above. It deliberately
 * does not absorb a literal: `GET /api/playdates/past` names a route that does
 * not exist, and letting ":id" swallow "past" reported it as served while
 * `guardObjectIdParams` answered 404 at runtime, which is precisely the
 * "compiles fine, 404s at runtime" bug this file exists to catch. The query
 * string above is stripped for the same reason; this is the same absorption one
 * segment over.
 *
 * A literal call segment therefore has to match a literal route segment. That
 * is stricter than Express, which really would route "past" to "/:id" - the
 * point is that doing so is a mistake worth failing on, not a feature.
 */
const matchesRoute = (callPath, routePath) => {
  const a = callPath.split("/").filter(Boolean);
  const b = routePath.split("/").filter(Boolean);
  if (a.length !== b.length) return false;
  return a.every((seg, i) =>
    b[i].startsWith(":") ? seg === ":param" : seg !== ":param" && seg.toLowerCase() === b[i].toLowerCase()
  );
};

test("every endpoint the app calls is served by the backend", () => {
  const served = readServedRoutes();
  const calls = readAppCalls();

  assert.ok(calls.size > 0, "expected to find API calls in the app source");

  const unmatched = [];
  for (const [key, files] of calls) {
    const [method, callPath] = key.split(" ");
    const hit = served.find((r) => r.method === method && matchesRoute(callPath, r.path));
    if (!hit) unmatched.push(`${key}  (called from ${[...new Set(files)].join(", ")})`);
  }

  assert.deepEqual(unmatched, [], `app calls with no backend route:\n  ${unmatched.join("\n  ")}`);
});

test("no router mounts a path that repeats its own prefix", () => {
  const offenders = [];
  for (const [mount, moduleName] of Object.entries(readMounts())) {
    const segment = mount.replace("/api/", "");
    const src = fs.readFileSync(path.join(BACKEND, "routes", `${moduleName}.js`), "utf8");
    for (const m of src.matchAll(/router\.\w+\(\s*["'](\/[^"']*)["']/g)) {
      const first = m[1].split("/").filter(Boolean)[0];
      if (first && first.toLowerCase() === segment.toLowerCase()) {
        offenders.push(`${moduleName}.js declares "${m[1]}" under mount ${mount}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `routes repeating their mount prefix:\n  ${offenders.join("\n  ")}`);
});

test("static route segments are registered before parameterised ones", () => {
  const byFile = new Map();
  for (const route of readServedRoutes()) {
    if (!byFile.has(route.file)) byFile.set(route.file, []);
    byFile.get(route.file).push(route);
  }

  const shadowed = [];
  for (const [file, routes] of byFile) {
    for (const [i, later] of routes.entries()) {
      const laterSegs = later.path.split("/").filter(Boolean);
      if (!laterSegs.some((s) => !s.startsWith(":"))) continue;

      for (const earlier of routes.slice(0, i)) {
        if (earlier.method !== later.method) continue;
        const earlierSegs = earlier.path.split("/").filter(Boolean);
        if (earlierSegs.length !== laterSegs.length) continue;

        // The earlier route shadows this one if every segment either matches
        // literally or is a parameter sitting where this route wants a literal.
        const shadows = earlierSegs.every((seg, j) =>
          seg.startsWith(":") ? true : seg === laterSegs[j]
        );
        const hasParamOverLiteral = earlierSegs.some(
          (seg, j) => seg.startsWith(":") && !laterSegs[j].startsWith(":")
        );

        if (shadows && hasParamOverLiteral) {
          shadowed.push(`${file}: "${earlier.method} ${earlier.path}" shadows "${later.path}"`);
        }
      }
    }
  }

  assert.deepEqual(shadowed, [], `unreachable routes:\n  ${shadowed.join("\n  ")}`);
});

test("every route file exports an Express router", () => {
  process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/contract-check";
  const dir = path.join(BACKEND, "routes");

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const router = require(path.join(dir, file));
    assert.equal(typeof router, "function", `${file} does not export a router`);
    assert.ok(router.stack, `${file} export is not an Express router`);
  }
});

test("Firebase Admin initialises when it is actually configured", () => {
  // config/firebase.js only runs its initialisation when the FIREBASE_*
  // variables are present, and the suite deliberately runs without them - so
  // the one line that talks to firebase-admin was never executed by any test.
  // It was broken for exactly that reason: v13 removed `admin.credential` from
  // the default export, and the namespaced call threw at require time in every
  // environment that had credentials, which is all of them except this suite.
  const { generateKeyPairSync } = require("node:crypto");
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const probe =
    "const fb = require('./config/firebase');" +
    "if (!fb.isEnabled()) { console.error('not enabled'); process.exit(2); }" +
    "for (const fn of ['verifyIdToken', 'sendMessage', 'deleteUser']) {" +
    "  if (typeof fb[fn] !== 'function') { console.error('missing ' + fn); process.exit(3); }" +
    "}";

  const result = require("node:child_process").spawnSync(
    process.execPath,
    ["-e", probe],
    {
      cwd: BACKEND,
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "demo-project",
        FIREBASE_CLIENT_EMAIL: "demo@demo-project.iam.gserviceaccount.com",
        FIREBASE_PRIVATE_KEY: privateKey,
      },
    }
  );

  assert.equal(
    result.status,
    0,
    `config/firebase.js failed to initialise with credentials set:
${result.stderr}`
  );
});

test("the app never imports backend source", () => {
  const offenders = appSourceFiles().filter((file) => {
    const src = fs.readFileSync(file, "utf8");
    return /["'][^"']*\/backend\//.test(src);
  });

  assert.deepEqual(
    offenders.map((f) => path.relative(APP, f)),
    [],
    "the app must talk to the API over HTTP, never import backend code"
  );
});

test("the backend never imports app source", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "test"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        if (/["'][^"']*PetPalsConnectApp/.test(fs.readFileSync(full, "utf8"))) {
          offenders.push(path.relative(BACKEND, full));
        }
      }
    }
  };
  walk(BACKEND);

  assert.deepEqual(offenders, [], "the backend must not import mobile app code");
});

const fs = require("node:fs");
const path = require("node:path");

/**
 * The screenshot tooling must not reach the app.
 *
 * `tools/web-stubs` contains a Firebase that cannot authenticate and a Stripe
 * that cannot take a payment. They are safe because they are unreachable from a
 * device build: Metro swaps them in only when `platform === "web"`, and the
 * gallery is behind an `EXPO_PUBLIC_GALLERY` check that Metro inlines away.
 *
 * Both of those are one careless edit from being untrue, and the failure would
 * be silent - an app that builds, ships, and cannot sign anybody in. So the two
 * routes in are checked here rather than trusted. Verified once against a real
 * Android bundle's source map: 2241 modules, none of them from `tools/`, and no
 * react-native-web.
 */

const ROOT = path.resolve(__dirname, "../..");

const walk = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
};

describe("the screenshot tooling stays out of the app", () => {
  it("is not imported by anything the app ships", () => {
    const offenders = [];

    for (const file of [...walk(path.join(ROOT, "src")), path.join(ROOT, "App.js")]) {
      const source = fs.readFileSync(file, "utf8");
      if (/from\s+["'][^"']*tools\/(gallery|web-stubs)/.test(source)) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    // The only two ways in are `index.js` (guarded) and metro's web resolver.
    expect(offenders).toEqual([]);
  });

  it("reaches the gallery only behind the build-time flag", () => {
    const entry = fs.readFileSync(path.join(ROOT, "index.js"), "utf8");

    // Metro inlines `process.env.EXPO_PUBLIC_*`, so the branch - and the
    // require inside it - is eliminated from a normal bundle rather than
    // shipped as dead code.
    expect(entry).toMatch(/process\.env\.EXPO_PUBLIC_GALLERY\s*===\s*"1"/);
    expect(entry).toMatch(/require\("\.\/tools\/gallery\/Gallery"\)/);
  });

  it("swaps a stub in only for the web platform", () => {
    const config = fs.readFileSync(path.join(ROOT, "metro.config.js"), "utf8");

    expect(config).toMatch(/platform === "web" && stub/);
  });

  it("stubs every module it claims to, and nothing it does not", () => {
    const config = fs.readFileSync(path.join(ROOT, "metro.config.js"), "utf8");
    const declared = [...config.matchAll(/"(tools\/web-stubs\/[\w-]+\.js)"/g)].map(
      ([, file]) => file
    );

    const onDisk = fs
      .readdirSync(path.join(ROOT, "tools/web-stubs"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `tools/web-stubs/${name}`);

    // A stub nothing points at is a file somebody will eventually import by
    // hand, which is how one of these ends up in a shipped bundle.
    expect([...declared].sort()).toEqual([...onDisk].sort());
  });

  it("never pretends to have signed anybody in", () => {
    const auth = fs.readFileSync(
      path.join(ROOT, "tools/web-stubs/firebase-auth.js"),
      "utf8"
    );

    // The gallery renders a session from its own fixture, visibly. A stub that
    // returned a user would make every screen claim one that does not exist.
    expect(auth).toMatch(/currentUser: null/);
    expect(auth).not.toMatch(/uid:\s*["']/);
  });
});

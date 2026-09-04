import fs from "fs";
import path from "path";

/**
 * Guards navigation params against the screens that read them.
 *
 * A `navigate("PetDetails", { petId })` into a screen that does
 * `const { pet } = route.params` is not a type error, not a lint error, and
 * bundles cleanly. It throws - or renders blank - the moment someone taps.
 *
 * There were eight of them at once: PetDetails reached with an id from six
 * places while the screen wanted the whole document, MediaView sent
 * `mediaItems` to a screen reading `media`, PotentialPlaydateLocation sent
 * `locationId`/`playdateId` to one reading `placeId`, and GroupChat sent
 * `chatId` to one reading `group`, which then dereferenced `group._id`.
 */

const SRC = path.resolve(__dirname, "../..");
const NAVIGATORS = [
  path.join(SRC, "screens/navigation/AppStack.js"),
  path.join(SRC, "screens/navigation/BottomTab.js"),
];

const sourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  };
  walk(SRC);
  return out;
};

/** Route name -> the file backing it, resolved through the navigator imports. */
const routeFiles = () => {
  const routes = {};

  for (const navigator of NAVIGATORS) {
    const source = fs.readFileSync(navigator, "utf8");

    const imports = {};
    for (const match of source.matchAll(/import\s+(\w+)\s+from\s+"([^"]+)"/g)) {
      imports[match[1]] = match[2];
    }

    // Screens that need a pet are registered through a wrapper
    // (`const MapWithPet = withRequiredPet(MapScreen, ...)`), so the component
    // named on the Screen is a local alias, not the import.
    const aliases = {};
    for (const match of source.matchAll(/const\s+(\w+)\s*=\s*with\w+\(\s*(\w+)/g)) {
      aliases[match[1]] = match[2];
    }

    for (const match of source.matchAll(/name="(\w+)"\s+component=\{(\w+)\}/g)) {
      const component = aliases[match[2]] ?? match[2];
      const relative = imports[component];
      if (!relative) continue;
      let file = path.normalize(path.join(path.dirname(navigator), relative));
      if (!file.endsWith(".js")) file += ".js";
      if (fs.existsSync(file)) routes[match[1]] = file;
    }
  }
  return routes;
};

/** The params a screen actually reads, however it destructures them. */
const paramsRead = (file) => {
  const source = fs.readFileSync(file, "utf8");
  const keys = new Set();

  for (const match of source.matchAll(/route\??\.params\??\.(\w+)/g)) keys.add(match[1]);
  for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*route\??\.params/g)) {
    match[1]
      .split(",")
      .map((part) => part.trim().split(":")[0].split("=")[0].trim())
      .filter(Boolean)
      .forEach((key) => keys.add(key));
  }
  return keys;
};

describe("navigation params", () => {
  const routes = routeFiles();

  it("resolves the screens behind the route names", () => {
    expect(Object.keys(routes).length).toBeGreaterThan(20);
  });

  it("every navigate() sends at least one param the target screen reads", () => {
    const mismatches = [];

    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, "utf8");

      for (const match of source.matchAll(/navigate\(\s*"(\w+)"\s*,\s*\{([^}]*)\}/g)) {
        const [, route, paramsBlock] = match;
        if (!routes[route]) continue;

        const wanted = [...paramsRead(routes[route])];
        if (wanted.length === 0) continue;

        const sent = paramsBlock
          .split(",")
          .map((part) => part.trim().split(":")[0].trim())
          .filter(Boolean);

        if (!sent.some((key) => wanted.includes(key))) {
          mismatches.push(
            `${path.relative(SRC, file)} -> ${route} sends {${sent.join(", ")}} ` +
              `but the screen reads {${wanted.join(", ")}}`
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("every navigate() names a route that exists", () => {
    // A typo, or a screen someone forgot to register, is a dead button.
    const known = new Set([
      ...Object.keys(routes),
      // Tab and stack names that live outside the two navigators.
      "Notifications",
      "Playdates",
      "Discover",
      "Home",
      "Chats",
      "More",
      "Login",
      "Register",
      "EmailAuth",
      "PhoneAuth",
      "VerificationSelection",
      "CreateProfile",
      "AddFirstPet",
    ]);

    const unknown = new Set();
    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/navigate\(\s*"(\w+)"/g)) {
        if (!known.has(match[1])) {
          unknown.add(`${path.relative(SRC, file)} -> ${match[1]}`);
        }
      }
    }

    expect([...unknown]).toEqual([]);
  });
});

import fs from "fs";
import path from "path";

import store from "./store";

/**
 * Guards the store shape against the selectors that read it.
 *
 * `combineReducers` mounted the slices as user/chat/pet/playdate/notifications,
 * while every selector in the app read `state.userReducer.*` and friends. Those
 * are undefined, so `state.userReducer.userId` threw on any screen using
 * useSelector. Neither bundling nor lint catches that, and it is invisible
 * until the screen renders.
 */

const SOURCE_ROOTS = ["src", "services"];

const sourceFiles = () => {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name))
        out.push(full);
    }
  };
  SOURCE_ROOTS.forEach(walk);
  return out;
};

/** Every `state.<slice>.<field>` the app reads, with where it appears. */
const selectorPaths = () => {
  const found = new Map();
  for (const file of sourceFiles()) {
    const src = fs.readFileSync(file, "utf8");
    for (const match of src.matchAll(/\bstate\.([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)/g)) {
      const key = `${match[1]}.${match[2]}`;
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(file);
    }
  }
  return found;
};

describe("redux store", () => {
  it("exposes the slices the app expects", () => {
    expect(Object.keys(store.getState()).sort()).toEqual([
      "chat",
      "notifications",
      "pet",
      "playdate",
      "user",
    ]);
  });

  it("every selector in the app reads a slice that exists", () => {
    const state = store.getState();
    const missing = [];

    for (const [selector, files] of selectorPaths()) {
      const [slice] = selector.split(".");
      if (!(slice in state)) {
        missing.push(`state.${selector} - no "${slice}" slice (${files.length} file(s))`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("every selector reads a field that exists on its slice", () => {
    const state = store.getState();
    const missing = [];

    for (const [selector, files] of selectorPaths()) {
      const [slice, field] = selector.split(".");
      if (!(slice in state)) continue;
      if (!(field in state[slice])) {
        missing.push(
          `state.${selector} - "${slice}" has no "${field}" (${files
            .map((f) => path.basename(f))
            .join(", ")})`
        );
      }
    }

    expect(missing).toEqual([]);
  });

  it("finds selectors at all, so the check cannot pass vacuously", () => {
    expect(selectorPaths().size).toBeGreaterThan(5);
  });
});

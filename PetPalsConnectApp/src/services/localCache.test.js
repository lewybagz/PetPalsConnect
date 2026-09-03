import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  readCache,
  writeCache,
  removeCache,
  staleWhileRevalidate,
  CacheKeys,
} from "./localCache";

beforeEach(async () => {
  await AsyncStorage.clear();
});

// Restored after each test rather than before the next one: writeCache swallows
// storage errors by design, so a mock leaking forward fails silently and the
// following test sees an empty cache for no visible reason.
afterEach(() => {
  jest.restoreAllMocks();
});

describe("localCache", () => {
  it("round-trips a value", async () => {
    await writeCache("thing", { a: 1 });
    expect(await readCache("thing")).toEqual({ a: 1 });
  });

  it("namespaces keys so it cannot collide with other storage users", async () => {
    await writeCache("thing", 1);
    expect(await AsyncStorage.getItem("@petpals/thing")).toBe("1");
  });

  it("returns the fallback when nothing is stored", async () => {
    expect(await readCache("missing", "default")).toBe("default");
    expect(await readCache("missing")).toBeNull();
  });

  it("removes a value", async () => {
    await writeCache("thing", 1);
    await removeCache("thing");
    expect(await readCache("thing")).toBeNull();
  });

  it("returns the fallback rather than throwing on corrupt JSON", async () => {
    // A cache is disposable; bad data must never take the app down.
    await AsyncStorage.setItem("@petpals/broken", "{not json");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(await readCache("broken", "fallback")).toBe("fallback");
    warn.mockRestore();
  });

  it("survives a storage failure on write", async () => {
    // Swapped and restored by hand rather than with spyOn: the async-storage
    // jest mock's methods are already jest.fn()s, so restoreAllMocks does not
    // put the original back and the mock leaks into later tests - where
    // writeCache swallows the error by design and the failure looks unrelated.
    const original = AsyncStorage.setItem;
    AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error("disk full"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(writeCache("thing", 1)).resolves.toBeUndefined();
    } finally {
      AsyncStorage.setItem = original;
      warn.mockRestore();
    }
  });

  it("exposes stable key names", () => {
    // Keys are persisted, so renaming one silently orphans stored data.
    expect(CacheKeys).toEqual({
      pets: "pets",
      friends: "friends",
      settings: "settings",
      navigationState: "navigation-state",
      userData: "user-data",
    });
  });
});

describe("staleWhileRevalidate", () => {
  it("serves the cached value first, then the fresh one", async () => {
    await writeCache("swr", ["cached"]);
    const seen = [];

    await staleWhileRevalidate("swr", async () => ["fresh"], (data, meta) =>
      seen.push([data, meta.fromCache])
    );

    expect(seen).toEqual([
      [["cached"], true],
      [["fresh"], false],
    ]);
  });

  it("stores the fresh value for next time", async () => {
    await staleWhileRevalidate("swr", async () => ["fresh"], () => {});
    expect(await readCache("swr")).toEqual(["fresh"]);
  });

  it("falls back to the cached value when the fetch fails", async () => {
    await writeCache("swr", ["cached"]);

    const result = await staleWhileRevalidate(
      "swr",
      async () => {
        throw new Error("offline");
      },
      () => {}
    );

    expect(result).toEqual(["cached"]);
  });

  it("rethrows when the fetch fails and there is nothing cached", async () => {
    await expect(
      staleWhileRevalidate("swr", async () => {
        throw new Error("offline");
      })
    ).rejects.toThrow("offline");
  });

  it("works without an onFresh callback", async () => {
    await expect(staleWhileRevalidate("swr", async () => 1)).resolves.toBe(1);
  });
});

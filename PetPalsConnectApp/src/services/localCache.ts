import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Small JSON cache backed by AsyncStorage.
 *
 * This replaces Realm, which MongoDB deprecated in September 2024 and stopped
 * supporting on 30 September 2025. The app used Realm purely as an offline
 * read-cache and for a little UI state - no sync, no queries beyond simple
 * filters - so a key/value store covers the same ground without a native
 * database or a paid sync service.
 *
 * MongoDB (via the API) is the source of truth; everything here is disposable.
 */

/** `catch` binds `unknown` under strict mode, so narrow before reading. */
const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const prefix = (key: string) => `@petpals/${key}`;

/**
 * `T` is what the caller expects to find, not a guarantee: the value was
 * written by an older build of the app and is parsed from JSON, so treat it as
 * a hint and tolerate a shape that has since changed.
 */
export const readCache = async <T>(key: string, fallback: T | null = null) => {
  try {
    const raw = await AsyncStorage.getItem(prefix(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    console.warn(`[cache] read "${key}" failed:`, describe(error));
    return fallback;
  }
};

export const writeCache = async <T>(key: string, value: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(prefix(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`[cache] write "${key}" failed:`, describe(error));
  }
};

export const removeCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(prefix(key));
  } catch (error) {
    console.warn(`[cache] remove "${key}" failed:`, describe(error));
  }
};

/**
 * Returns cached data immediately (if any), then refreshes from the network and
 * updates the cache. `onFresh` is called only when the fetch succeeds.
 */
export const staleWhileRevalidate = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  onFresh?: (value: T, meta: { fromCache: boolean }) => void
): Promise<T> => {
  const cached = await readCache<T>(key);
  if (cached && onFresh) onFresh(cached, { fromCache: true });

  try {
    const fresh = await fetcher();
    await writeCache(key, fresh);
    if (onFresh) onFresh(fresh, { fromCache: false });
    return fresh;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
};

export const CacheKeys = {
  pets: "pets",
  friends: "friends",
  settings: "settings",
  navigationState: "navigation-state",
  userData: "user-data",
};

export default { readCache, writeCache, removeCache, staleWhileRevalidate, CacheKeys };

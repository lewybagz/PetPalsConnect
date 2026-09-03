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

const prefix = (key) => `@petpals/${key}`;

export const readCache = async (key, fallback = null) => {
  try {
    const raw = await AsyncStorage.getItem(prefix(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`[cache] read "${key}" failed:`, error.message);
    return fallback;
  }
};

export const writeCache = async (key, value) => {
  try {
    await AsyncStorage.setItem(prefix(key), JSON.stringify(value));
  } catch (error) {
    console.warn(`[cache] write "${key}" failed:`, error.message);
  }
};

export const removeCache = async (key) => {
  try {
    await AsyncStorage.removeItem(prefix(key));
  } catch (error) {
    console.warn(`[cache] remove "${key}" failed:`, error.message);
  }
};

/**
 * Returns cached data immediately (if any), then refreshes from the network and
 * updates the cache. `onFresh` is called only when the fetch succeeds.
 */
export const staleWhileRevalidate = async (key, fetcher, onFresh) => {
  const cached = await readCache(key);
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

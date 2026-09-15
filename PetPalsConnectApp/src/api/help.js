import api from "./axios";
import { readCache, writeCache } from "../services/localCache";

/**
 * How PetPals works: the one table the help screen shows and Spot searches.
 *
 * Cached the way the toxin table is, because the help screen is where
 * somebody goes when something is not working - which may be the
 * connection. An empty answer never replaces a good cached copy.
 */
const CACHE_KEY = "help-table-v1";

const EMPTY = { topics: {}, entries: [] };

export const fetchHelp = async () => {
  const cached = await readCache(CACHE_KEY, null);
  try {
    const { data } = await api.get("/api/petcare/help");
    const payload = {
      topics: data?.topics && typeof data.topics === "object" ? data.topics : {},
      entries: Array.isArray(data?.entries) ? data.entries : [],
    };
    if (!payload.entries.length) return { ...(cached ?? EMPTY), stale: true };
    await writeCache(CACHE_KEY, payload);
    return { ...payload, stale: false };
  } catch {
    if (cached) return { ...cached, stale: true };
    return { ...EMPTY, stale: true };
  }
};

/** Entries grouped in the table's topic order. */
export const groupByTopic = ({ topics = {}, entries = [] } = {}) =>
  Object.entries(topics)
    .map(([key, label]) => ({ key, label, entries: entries.filter((entry) => entry.topic === key) }))
    .filter((group) => group.entries.length > 0);

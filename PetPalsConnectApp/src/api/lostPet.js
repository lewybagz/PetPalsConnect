import api from "./axios";
import { readCache, writeCache } from "../services/localCache";

/**
 * The lost-pet checklist, from the app's side.
 *
 * Cached for the same reason the poison table is: somebody reading this is
 * standing in the street, and the steps and their own chip number have to be
 * there whether or not the network is. The chip numbers come from the caller's
 * own identification records, so this is cached per account.
 *
 * There is no broadcast and no map of lost pets here. That is a different
 * product, and a feature implying a search party exists when it does not
 * would be worse than the honest checklist.
 */

const CACHE_KEY = "lost-pet";

export const fetchLostPet = async () => {
  const cached = await readCache(CACHE_KEY, null);

  try {
    const { data } = await api.get("/api/petcare/lost-pet");
    const payload = {
      steps: Array.isArray(data?.steps) ? data.steps : [],
      contacts: Array.isArray(data?.contacts) ? data.contacts : [],
      identification: Array.isArray(data?.identification) ? data.identification : [],
    };

    // An empty checklist is never a better answer than a stale one.
    if (!payload.steps.length) {
      return { ...(cached ?? { steps: [], contacts: [], identification: [] }), stale: true };
    }

    await writeCache(CACHE_KEY, payload);
    return { ...payload, stale: false };
  } catch {
    if (cached) return { ...cached, stale: true };
    return { steps: [], contacts: [], identification: [], stale: true };
  }
};

import api from "./axios";
import { readCache, writeCache } from "../services/localCache";

/**
 * The poison lookup, from the app's side.
 *
 * The whole table arrives in one call and is cached, and the search runs on
 * the device against that copy. This is the one screen in the app that has to
 * work with no signal: somebody standing in a garage at midnight holding a
 * chewed packet does not need a spinner, and "could not load" is an unusable
 * answer to "my dog ate a bulb". So the network is how the table is *kept*
 * current, not how a question is answered.
 *
 * It describes published guidance and never prescribes - no dose, no
 * threshold, no "should I worry" branch. Every answer, including a miss, ends
 * at a phone number.
 */

const CACHE_KEY = "toxins";

/**
 * Kept in step with `backend/services/petCare/toxins.js`. Two copies of a
 * sort order is a smaller problem than a round trip on this screen, and
 * `toxins.test.js` on the backend pins the vocabulary both sides use.
 */
export const SEVERITY_RANK = { emergency: 0, call: 1, avoid: 2 };

export const SEVERITY_LABELS = {
  emergency: "Do not wait",
  call: "Ring for advice",
  avoid: "Keep it away",
};

/**
 * What the card says under the heading. Deliberately about what to *do*
 * rather than how bad it is - a severity is an instruction here, not a score.
 */
export const SEVERITY_BLURBS = {
  emergency: "Published guidance says to get help now rather than wait for signs.",
  call: "Worth ringing so somebody can weigh the details with you.",
  avoid: "Keep it out of reach. Ring if you are unsure or the animal is small.",
};

const normalise = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The same one-directional rule the server uses, and for the same reason: a
 * bare "tea" is an alias of caffeine, and letting it claim the longer query
 * "tea tree" answered a question about a cat's liver with one about a dog's
 * heart. A near-miss on this screen is worse than no match.
 */
const matchesTerm = (candidate, term) => {
  if (candidate.includes(term)) return true;
  if (!candidate.includes(" ")) return false;
  return term.includes(candidate);
};

const bySeverityThenName = (a, b) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name);

/** Searches a table already in hand. Pure, so the screen can call it freely. */
export const searchToxins = (toxins, query) => {
  const term = normalise(query);
  if (!term) return [];

  return toxins
    .filter((toxin) =>
      [toxin.name, ...(toxin.aliases ?? [])]
        .map(normalise)
        .some((candidate) => candidate && matchesTerm(candidate, term))
    )
    .sort(bySeverityThenName);
};

/** Narrows a result set to one species, when the owner has picked a pet. */
export const forSpecies = (toxins, species) =>
  species ? toxins.filter((toxin) => toxin.species.includes(species)) : toxins;

/**
 * The table, from the cache first and the network second.
 *
 * Answers with whatever it has: a cached copy is returned immediately and the
 * refresh happens behind it, so the screen is usable on the first frame and
 * on a dead connection. `stale` tells the screen whether it is looking at a
 * cached copy that could not be refreshed, which is worth saying quietly and
 * is never a reason to show nothing.
 */
export const fetchToxins = async () => {
  const cached = await readCache(CACHE_KEY, null);

  try {
    const { data } = await api.get("/api/petcare/toxins");
    const payload = {
      toxins: Array.isArray(data?.toxins) ? data.toxins : [],
      contacts: Array.isArray(data?.contacts) ? data.contacts : [],
    };

    // An empty table would render as "nothing is dangerous", so a bad response
    // keeps whatever was cached rather than replacing it with nothing.
    if (!payload.toxins.length) {
      return { ...(cached ?? { toxins: [], contacts: [] }), stale: true };
    }

    await writeCache(CACHE_KEY, payload);
    return { ...payload, stale: false };
  } catch {
    if (cached) return { ...cached, stale: true };
    return { toxins: [], contacts: [], stale: true };
  }
};

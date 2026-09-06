import api from "./axios";

/**
 * The Articles feature, from the app's side.
 *
 * One module rather than three screens each writing their own call, for the
 * same reason as `favorites.js`: the two screens that did had drifted apart -
 * one built its own `Authorization` header from a stored token instead of
 * using the shared client, and both navigated with `item.id`, which is not a
 * field a Mongo document has.
 *
 * Every read here is editorial content, the same for every caller. It is still
 * behind `authenticate` like every other route in this app.
 */

/** How many articles a page of the list holds. */
export const PAGE_SIZE = 20;

/**
 * A page of the newest articles, optionally filtered to one topic.
 *
 * `/latest` was capped at twenty with no way to ask for more, so the corpus
 * outgrew the screen: article twenty-one was reachable only by guessing a word
 * in its title.
 */
export const fetchArticles = async ({ tag, skip = 0, limit = PAGE_SIZE } = {}) => {
  // Query values go through axios `params` rather than into the path, which
  // encodes them correctly and keeps the URL one thing the route contract can
  // compare against a declared route.
  const { data } = await api.get("/api/articles/latest", {
    params: { limit, skip, ...(tag ? { tag } : {}) },
  });
  return Array.isArray(data) ? data : [];
};

/** The single newest article - the home screen's shelf. */
export const fetchRecentArticle = async () => {
  const { data } = await api.get("/api/articles/recent");
  return data ?? null;
};

/** Full-text-ish search over titles, summaries and tags. */
export const searchArticles = async (query) => {
  const term = (query ?? "").trim();
  if (!term) return [];

  const { data } = await api.get("/api/articles/search", { params: { q: term } });
  return Array.isArray(data) ? data : [];
};

/**
 * The topics the corpus covers, with a count each, most-used first.
 *
 * Derived on the server from the articles themselves, so a chip can never
 * offer a topic with nothing behind it.
 */
export const fetchTopics = async () => {
  const { data } = await api.get("/api/articles/topics");
  return Array.isArray(data) ? data : [];
};

/** One article, in full. */
export const fetchArticle = async (articleId) => {
  const { data } = await api.get(`/api/articles/${articleId}`);
  return data ?? null;
};

/** Further reading: articles sharing the most tags with this one. */
export const fetchRelatedArticles = async (articleId, limit = 3) => {
  const { data } = await api.get(`/api/articles/${articleId}/related`, {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
};

/**
 * Tags the corpus uses to name a species, as opposed to a subject.
 *
 * The browse row leads with these because "do you have a cat or a rabbit" is
 * the first cut a reader makes, and it is a much bigger cut than "behaviour"
 * or "safety".
 */
export const SPECIES_TAGS = [
  "dogs",
  "cats",
  "rabbits",
  "guinea-pigs",
  "birds",
  "reptiles",
  "fish",
  "small-pets",
];

/** Orders topics species-first, then by how much is behind each one. */
export const orderTopics = (topics) => {
  const rank = (topic) => {
    const index = SPECIES_TAGS.indexOf(topic.tag);
    return index === -1 ? SPECIES_TAGS.length : index;
  };
  return [...topics].sort(
    (a, b) => rank(a) - rank(b) || b.count - a.count || a.tag.localeCompare(b.tag)
  );
};

/** "guinea-pigs" -> "Guinea pigs". Tags are lowercase and hyphenated. */
export const topicLabel = (tag) => {
  const spaced = String(tag ?? "").replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

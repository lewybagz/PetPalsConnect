import api from "./axios";

/**
 * Favourites, from the app's side.
 *
 * Four screens each wrote their own call, and two of them sent `user` and
 * `creator` in the body - which the server takes from the token and ignores,
 * and which would have let a client favourite a pet as somebody else if it
 * did not.
 */

/** Adds a pet to the caller's favourites. Safe to call twice. */
export const addFavorite = async (petId) => {
  const { data } = await api.post("/api/favorites", { content: petId });
  return data;
};

/** Removes one. Idempotent - unfavouriting something that is not is fine. */
export const removeFavorite = async (petId) => {
  const { data } = await api.delete(`/api/favorites/pet/${petId}`);
  return Boolean(data?.removed);
};

/** The caller's favourites. */
export const fetchFavorites = async () => {
  const { data } = await api.get("/api/favorites");
  return Array.isArray(data) ? data : [];
};

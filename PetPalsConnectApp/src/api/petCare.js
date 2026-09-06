import api from "./axios";

/**
 * The care hub, from the app's side.
 *
 * Two calls, because the hub has two halves with different needs. Picks are
 * about the pets the caller owns and need no location; places are about where
 * somebody is and need one. Fetching them separately means a hub with no
 * position still shows everything it can, rather than nothing.
 */

/**
 * Product recommendations for the caller's own pets.
 *
 * Comes back as one entry per pet - "food" means a different thing for the cat
 * than for the dog, and one merged list would be a list the owner has to sort
 * out themselves.
 */
export const fetchCarePicks = async () => {
  const { data } = await api.get("/api/petcare/picks");
  return {
    categories: data?.categories ?? [],
    placeCategories: data?.placeCategories ?? [],
    emergency: data?.emergency ?? [],
    pets: Array.isArray(data?.pets) ? data.pets : [],
  };
};

/**
 * Vets, shops, groomers and boarders near a position.
 *
 * `category` is optional and narrows to one kind. Without coordinates the
 * server answers with whatever places it holds rather than an error, so a
 * caller who has not shared a position still gets a list.
 */
export const fetchCarePlaces = async ({ latitude, longitude, range, category } = {}) => {
  const { data } = await api.get("/api/locations/care", {
    params: {
      ...(latitude != null && longitude != null
        ? { lat: latitude, lng: longitude }
        : {}),
      ...(range ? { range } : {}),
      ...(category ? { category } : {}),
    },
  });

  return {
    locationKnown: Boolean(data?.locationKnown),
    importable: Boolean(data?.importable),
    emergency: Array.isArray(data?.emergency) ? data.emergency : [],
    // Deliberately not filtered by the category or the range: somebody's own
    // vet is the entry they came to find.
    saved: Array.isArray(data?.saved) ? data.saved : [],
    places: Array.isArray(data?.places) ? data.places : [],
  };
};

/** Saves a place to the caller's own list. Safe to call twice. */
export const savePlace = async (locationId) => {
  const { data } = await api.post("/api/favorites/places", { locationId });
  return data;
};

/** Removes one. Idempotent - unsaving something that is not saved is fine. */
export const unsavePlace = async (locationId) => {
  const { data } = await api.delete(`/api/favorites/place/${locationId}`);
  return Boolean(data?.removed);
};

/** One place, with the contact details the server fills in on first open. */
export const fetchPlace = async (locationId) => {
  const { data } = await api.get(`/api/locations/${locationId}`);
  return data;
};

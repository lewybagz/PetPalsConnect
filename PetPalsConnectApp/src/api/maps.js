import api from "./axios";

/**
 * What goes on the map.
 *
 * `MapScreen` fetched `/api/petmatches/matched-pets` and read `pet.location.lat`
 * off the result. That endpoint returns PetMatch documents, and a pet has no
 * coordinates at all - the position lives on its owner - so every marker was
 * `{ latitude: undefined, longitude: undefined }` and the map has never shown
 * one. It also called its own places fetch with no arguments, so `userLat`,
 * `userLng` and `range` all went as `undefined`.
 */

/**
 * Matched pets, placed at their owners' positions, plus where you are.
 *
 * The server names the fields `latitude`/`longitude` rather than handing back
 * GeoJSON, so no screen has to remember that the stored pair is [lng, lat] -
 * the order that puts a park in the sea when it is got wrong.
 */
export const fetchMapPets = async () => {
  const { data } = await api.get("/api/petmatches/map");

  return {
    pets: Array.isArray(data?.pets) ? data.pets : [],
    origin: data?.origin ?? null,
    range: typeof data?.range === "number" ? data.range : null,
  };
};

/** Places to meet, nearest first. Omit the position to get everything. */
export const fetchPlaces = async ({ latitude, longitude, rangeMiles } = {}) => {
  const { data } = await api.get("/api/locations", {
    params:
      latitude != null && longitude != null
        ? { lat: latitude, lng: longitude, range: rangeMiles }
        : undefined,
  });

  return Array.isArray(data) ? data : [];
};

/**
 * Pulls nearby places in from Google.
 *
 * The collection is empty on a fresh deployment, and an empty map is
 * indistinguishable from a broken one. Reports `configured: false` rather than
 * throwing when the server has no Google key, because that is a deployment
 * state and not something to show a user as an error.
 */
export const importPlaces = async ({ latitude, longitude, rangeMiles = 5 }) => {
  try {
    const { data } = await api.post("/api/locations/import", null, {
      params: { lat: latitude, lng: longitude, range: rangeMiles },
    });
    return { configured: true, imported: data?.imported ?? 0 };
  } catch (error) {
    if (error.response?.status === 503) return { configured: false, imported: 0 };
    throw error;
  }
};

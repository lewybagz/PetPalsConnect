const axios = require("axios");

const Location = require("../models/Location");

/**
 * Importing places from Google, and finding the ones near somebody.
 *
 * The map had nothing to show. `Location` rows are only ever created by
 * `POST /api/locations`, which no screen calls, so the collection is empty on
 * every deployment and "no parks near you" is indistinguishable from "the query
 * is broken" - which it also was: the near-query used a PascalCase path against
 * a schema with a lowercase one, so it matched nothing even with rows present.
 *
 * Google Places is optional in the same way Stripe is. Without a key the import
 * reports 503 and the rest of the map works on whatever rows exist; a missing
 * key must never stop the app from opening.
 */

const METRES_PER_MILE = 1609.34;

/** Parks and pet shops - the two place types a dog owner actually goes to. */
const PLACE_TYPES = ["park", "pet_store", "veterinary_care"];

const key = () => process.env.GOOGLE_MAPS_API_KEY || null;

const isEnabled = () => Boolean(key());

/**
 * Places within `radiusMiles` of a point, from Google.
 *
 * Returns the rows in this app's shape rather than Google's, so the controller
 * and the importer agree on what a place is without either of them knowing what
 * a `geometry.location` is.
 */
const search = async ({ latitude, longitude, radiusMiles = 5, type = "park" }) => {
  if (!isEnabled()) {
    const error = new Error("Google Places is not configured on this server");
    error.status = 503;
    throw error;
  }

  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      params: {
        location: `${latitude},${longitude}`,
        radius: Math.round(radiusMiles * METRES_PER_MILE),
        type,
        key: key(),
      },
      timeout: 10000,
    }
  );

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    const error = new Error(data.error_message || `Places API said ${data.status}`);
    error.status = 502;
    throw error;
  }

  return (data.results ?? []).map((place) => ({
    name: place.name,
    address: place.vicinity ?? place.formatted_address ?? "",
    placeId: place.place_id,
    rating: place.rating,
    geoLocation: {
      type: "Point",
      // GeoJSON is [longitude, latitude]; Google reports lat/lng.
      coordinates: [place.geometry.location.lng, place.geometry.location.lat],
    },
  }));
};

/**
 * Imports places near a point, skipping the ones already stored.
 *
 * Upserts on `placeId` so running it twice - which is what happens when two
 * users in the same city open the map - does not double the markers.
 */
const importNear = async ({ latitude, longitude, radiusMiles = 5 }) => {
  const found = [];

  for (const type of PLACE_TYPES) {
    found.push(...(await search({ latitude, longitude, radiusMiles, type })));
  }

  const results = await Promise.all(
    found
      .filter((place) => place.name && place.address && place.placeId)
      .map((place) =>
        Location.findOneAndUpdate(
          { placeId: place.placeId },
          { $set: { ...place, modifiedDate: new Date() }, $setOnInsert: { createdDate: new Date() } },
          { upsert: true, returnDocument: "after" }
        )
      )
  );

  return results;
};

/**
 * Stored places near a point, nearest first, with the distance attached.
 *
 * `$nearSphere` needs the 2dsphere index and sorts by distance itself, so this
 * is one query rather than a fetch-and-sort. A missing or unparseable position
 * falls back to "everything", because a list of places somewhere is more useful
 * than an empty screen.
 */
const nearby = async ({ latitude, longitude, radiusMiles, limit = 50 } = {}) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Location.find().limit(limit).lean();
  }

  const query = {
    geoLocation: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
      },
    },
  };

  // 0 or absent means "no limit", the same convention `playdateRange` uses.
  const miles = Number(radiusMiles);
  if (Number.isFinite(miles) && miles > 0) {
    query.geoLocation.$nearSphere.$maxDistance = miles * METRES_PER_MILE;
  }

  return Location.find(query).limit(limit).lean();
};

module.exports = {
  METRES_PER_MILE,
  PLACE_TYPES,
  isEnabled,
  search,
  importNear,
  nearby,
};

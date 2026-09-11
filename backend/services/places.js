const axios = require("axios");

const Location = require("../models/Location");
const { IMPORTS, categoriesFor } = require("./placeCategories");

/**
 * Importing places from Google, and finding the ones near somebody.
 *
 * The map had nothing to show. `Location` rows are only ever created by
 * `POST /api/locations`, which no screen calls, so the collection is empty on
 * every deployment and "no parks near you" is indistinguishable from "the query
 * is broken" - which it also was: the near-query used a PascalCase path against
 * a schema with a lowercase one, so it matched nothing even with rows present.
 *
 * Google Places is optional in the same way payments are. Without a key the import
 * reports 503 and the rest of the map works on whatever rows exist; a missing
 * key must never stop the app from opening.
 */

const METRES_PER_MILE = 1609.34;

/**
 * What an import pulls in, declared in `placeCategories.js`.
 *
 * This was a flat list of three Google types with no record of which was
 * which, so every row landed in the collection indistinguishable from the
 * others - a vet, a park and a pet shop all just "a place". The map could show
 * them; nothing could tell them apart, which is why the vet directory had to
 * be built somewhere else. Now the category the search was for is carried onto
 * the row.
 */
const PLACE_TYPES = IMPORTS.map((entry) => entry.type);

const key = () => process.env.GOOGLE_MAPS_API_KEY || null;

const isEnabled = () => Boolean(key());

/**
 * Places within `radiusMiles` of a point, from Google.
 *
 * Returns the rows in this app's shape rather than Google's, so the controller
 * and the importer agree on what a place is without either of them knowing what
 * a `geometry.location` is.
 */
const search = async ({
  latitude,
  longitude,
  radiusMiles = 5,
  type = "park",
  keyword = null,
  category = null,
}) => {
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
        // Grooming and boarding have no Google type of their own, so they go
        // out as a keyword against the closest type that does exist.
        ...(keyword ? { keyword } : {}),
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
    categories: categoriesFor(place.types, category),
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
  /**
   * Merged by place id before writing, rather than upserted per search.
   *
   * The same place comes back from more than one search - a vet that boards
   * answers both the `veterinary_care` and the `pet boarding kennel` query -
   * and upserting each hit separately would have the second write's
   * `categories` replace the first's, so whichever search ran last would win
   * and the row would claim one category instead of two.
   */
  const byPlaceId = new Map();

  for (const entry of IMPORTS) {
    const results = await search({
      latitude,
      longitude,
      radiusMiles,
      type: entry.type,
      keyword: entry.keyword,
      category: entry.category,
    });

    for (const place of results) {
      if (!place.name || !place.address || !place.placeId) continue;

      const existing = byPlaceId.get(place.placeId);
      if (!existing) {
        byPlaceId.set(place.placeId, place);
        continue;
      }
      existing.categories = [
        ...new Set([...(existing.categories ?? []), ...(place.categories ?? [])]),
      ];
    }
  }

  const results = await Promise.all(
    [...byPlaceId.values()].map((place) =>
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
const nearby = async ({
  latitude,
  longitude,
  radiusMiles,
  categories = null,
  limit = 50,
} = {}) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  /**
   * Only ever narrows when asked to.
   *
   * `categories` was added after rows existed, and those rows have none - they
   * were imported when every place was just "a place". So an unfiltered call
   * still returns everything, exactly as before, and the playdate pickers keep
   * working untouched. A filtered call deliberately leaves uncategorised rows
   * out: a row whose kind we do not know is not evidence of a vet, and putting
   * one in the vet list would be a worse failure than a short list. Re-running
   * the import backfills them.
   */
  // `Array.isArray`, not `length > 0`: an empty array is a caller that asked
  // for a filter and had nothing valid left after validation, and `$in: []`
  // correctly matches nothing. Treating it as "no filter" would answer a
  // request for a misspelled category with the entire collection - parks in
  // the vet list, which is the one wrong answer worse than an empty one.
  const categoryFilter = Array.isArray(categories)
    ? { categories: { $in: categories } }
    : {};

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Location.find(categoryFilter).limit(limit).lean();
  }

  const query = {
    ...categoryFilter,
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

/**
 * How long contact details stay fresh.
 *
 * A vet's phone number rarely changes and its opening hours change seasonally,
 * so a month is generous without ever showing a number that has been wrong for
 * a year. Re-fetching is one billed request, and only for a place somebody has
 * actually opened.
 */
const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Phone, website and opening hours for one place.
 *
 * `fields` is explicit because Google bills Details by the fields asked for,
 * and asking for everything costs several times what these four do.
 */
const details = async (placeId) => {
  if (!isEnabled()) {
    const error = new Error("Google Places is not configured on this server");
    error.status = 503;
    throw error;
  }

  const { data } = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json",
    {
      params: {
        place_id: placeId,
        fields: "formatted_phone_number,website,opening_hours,rating",
        key: key(),
      },
      timeout: 10000,
    }
  );

  if (data.status !== "OK") {
    const error = new Error(data.error_message || `Places API said ${data.status}`);
    error.status = 502;
    throw error;
  }

  return {
    phone: data.result?.formatted_phone_number ?? null,
    website: data.result?.website ?? null,
    openingHours: data.result?.opening_hours?.weekday_text ?? null,
    rating: data.result?.rating ?? null,
  };
};

/**
 * Fills in a place's contact details if they are missing or stale.
 *
 * Best-effort by design and returns the location either way: a vet's address
 * and a route to it are useful without a phone number, and a Details call that
 * fails - no key, a quota, a network blip - must never turn opening a place
 * into an error. Without a `placeId` there is nothing to ask about.
 */
const withDetails = async (location) => {
  if (!location?.placeId || !isEnabled()) return location;

  const fetchedAt = location.detailsFetchedAt?.getTime?.() ?? 0;
  if (Date.now() - fetchedAt < DETAILS_TTL_MS) return location;

  try {
    const fetched = await details(location.placeId);
    const update = {
      phone: fetched.phone ?? undefined,
      website: fetched.website ?? undefined,
      openingHours: fetched.openingHours ?? undefined,
      // Google's rating is the one it holds now, and it is the only rating
      // these rows have - nothing in the app writes one.
      ...(fetched.rating != null ? { rating: fetched.rating } : {}),
      detailsFetchedAt: new Date(),
    };

    await Location.updateOne({ _id: location._id }, { $set: update });
    Object.assign(location, update);
  } catch (error) {
    console.warn("[places] Details lookup failed:", error.message);
  }

  return location;
};

module.exports = {
  METRES_PER_MILE,
  DETAILS_TTL_MS,
  PLACE_TYPES,
  isEnabled,
  search,
  details,
  withDetails,
  importNear,
  nearby,
};

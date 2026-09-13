const axios = require("axios");

const Location = require("../models/Location");
const { IMPORTS, categoriesFor } = require("./placeCategories");
const { milesBetween } = require("./matching/distance");

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
// Not every import names a type - a trailhead has no single one - so the
// blanks are dropped rather than left as holes in the list.
const PLACE_TYPES = [...new Set(IMPORTS.map((entry) => entry.type).filter(Boolean))];

const key = () => process.env.GOOGLE_MAPS_API_KEY || null;

const isEnabled = () => Boolean(key());

/**
 * Places API (New), because the legacy one cannot be switched on any more.
 *
 * Google stopped enabling the legacy Places API for new Cloud projects, so
 * `maps/api/place/nearbysearch/json` answers "You're calling a legacy API,
 * which is not enabled for your project" no matter how the key is configured.
 * There is no console toggle for it; the endpoints below are the replacement.
 *
 * The console entry to enable is **Places API (New)** - a separate library
 * item from the old "Places API", and enabling the old one does nothing for
 * these calls.
 */
const PLACES_HOST = "https://places.googleapis.com/v1";

/**
 * The new API bills by the highest tier named in the field mask, and there is
 * no default set - omit the mask and every call is an error. `displayName` is
 * the expensive one here (Pro rather than Essentials), and it is also the only
 * way to get a human-readable name, which `Location.name` requires.
 */
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.rating",
].join(",");

const headers = (fieldMask) => ({
  "Content-Type": "application/json",
  // A header now, not a `key=` query parameter.
  "X-Goog-Api-Key": key(),
  // No spaces are permitted anywhere in the mask.
  "X-Goog-FieldMask": fieldMask,
});

/**
 * Google's error envelope, turned into the shape this service already threw.
 *
 * The legacy API answered 200 with a `status` string in the body, so the old
 * code inspected `data.status`. The new one uses real HTTP codes, which means
 * a failure lands in `catch` instead - and any leftover `data.status` check is
 * dead code that would pass everything through.
 */
const asPlacesError = (error) => {
  const body = error.response?.data?.error;
  const wrapped = new Error(
    body?.message || error.message || "Places API request failed"
  );
  wrapped.status = error.response?.status === 403 ? 403 : 502;
  return wrapped;
};

/**
 * One Google place in this app's shape.
 *
 * Three renames here are the ones that fail *quietly* rather than loudly, so
 * they are worth naming: `results` is `places`; `place_id` is `id` while
 * `name` is now the resource path `places/<id>` and the human name moved to
 * `displayName.text`; and `geometry.location.lat/lng` is
 * `location.latitude/longitude`. Reading `place.name` as before would write
 * "places/ChIJ..." into a required field, which validates and renders garbage.
 */
const toLocation = (place, category) => ({
  name: place.displayName?.text ?? null,
  address: place.formattedAddress ?? "",
  placeId: place.id,
  rating: place.rating,
  categories: categoriesFor(place.types, category),
  geoLocation: {
    type: "Point",
    // GeoJSON is [longitude, latitude]; Google reports them named in full.
    coordinates: [place.location?.longitude, place.location?.latitude],
  },
});

/**
 * Whether a result really is inside the circle we asked about.
 *
 * Only text searches need this - `searchNearby` takes a `locationRestriction`
 * and honours it. `milesBetween` is the matcher's haversine, reused rather
 * than rewritten: it already takes GeoJSON pairs, which is the shape
 * `toLocation` produces, and a second copy of that arithmetic is a second
 * place to put latitude and longitude the wrong way round.
 */
const withinRadius = (place, circle) => {
  const miles = milesBetween(place.geoLocation?.coordinates, [
    circle.center.longitude,
    circle.center.latitude,
  ]);
  // A place Google could not locate is not evidence of anything nearby.
  if (miles === null) return false;
  return miles <= circle.radius / METRES_PER_MILE;
};

/**
 * Places within `radiusMiles` of a point, from Google.
 *
 * Returns the rows in this app's shape rather than Google's, so the controller
 * and the importer agree on what a place is without either of them knowing
 * what a `displayName.text` is.
 *
 * Two endpoints behind one function, because the new API split what the legacy
 * one did in a single call: **Nearby Search takes types and has no free-text
 * parameter at all**, so grooming, boarding, patios, hotels and trails - every
 * category that exists only as a keyword - have to go through **Text Search**
 * instead. Callers should not have to know which, so the keyword decides.
 */
const search = async ({
  latitude,
  longitude,
  radiusMiles = 5,
  // No default: an entry that deliberately carries no type - a trailhead is
  // `hiking_area` or `nature_preserve`, never one predictable thing - must not
  // have `park` quietly reinstated under it.
  type = null,
  keyword = null,
  category = null,
}) => {
  if (!isEnabled()) {
    const error = new Error("Google Places is not configured on this server");
    error.status = 503;
    throw error;
  }

  const circle = {
    center: { latitude: Number(latitude), longitude: Number(longitude) },
    // Metres, and Google caps it at 50km.
    radius: Math.min(Math.round(radiusMiles * METRES_PER_MILE), 50000),
  };

  if (!keyword && !type) {
    // Nearby Search has no free-text parameter, so with neither a type nor a
    // keyword there is no question to ask.
    const error = new Error("A places search needs a type or a keyword");
    error.status = 400;
    throw error;
  }

  const [url, body] = keyword
    ? [
        `${PLACES_HOST}/places:searchText`,
        {
          textQuery: keyword,
          // Singular here; the Nearby endpoint takes an array. A type narrows
          // the query where one fits - "dog friendly patio" to restaurants -
          // and is left off where the answers have no single type, which is
          // the case for trailheads.
          ...(type ? { includedType: type } : {}),
          // Text Search takes a *bias*, not a restriction - only a rectangle
          // can restrict, and a circle is the shape we have. So the radius is
          // a preference here and the results are trimmed below.
          locationBias: { circle },
          pageSize: 20,
        },
      ]
    : [
        `${PLACES_HOST}/places:searchNearby`,
        {
          includedTypes: [type],
          locationRestriction: { circle },
          maxResultCount: 20,
        },
      ];

  let data;
  try {
    ({ data } = await axios.post(url, body, {
      headers: headers(SEARCH_FIELDS),
      timeout: 10000,
    }));
  } catch (error) {
    throw asPlacesError(error);
  }

  // Zero results omits the key entirely rather than sending an empty array -
  // proto3 drops empty repeated fields - so `data.places.length` would throw.
  const found = (data.places ?? [])
    .map((place) => toLocation(place, category))
    .filter((place) => place.name && place.placeId);

  // A bias is a preference, not a fence, so a text search will happily return
  // a hotel two counties over when the local ones run out. The importer's
  // whole promise is "places near this city", so the radius is applied here
  // rather than trusted to Google.
  return keyword ? found.filter((place) => withinRadius(place, circle)) : found;
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

  let data;
  try {
    // The id goes in the path now, and there is no `result` wrapper on the way
    // back - the place object *is* the body.
    ({ data } = await axios.get(`${PLACES_HOST}/places/${encodeURIComponent(placeId)}`, {
      // All four of these are Enterprise-tier fields, which is the whole
      // reason this call is lazy and cached for a month rather than run for
      // every result at import time.
      headers: headers(
        "nationalPhoneNumber,websiteUri,regularOpeningHours,rating"
      ),
      timeout: 10000,
    }));
  } catch (error) {
    throw asPlacesError(error);
  }

  return {
    // Renamed wholesale: `formatted_phone_number`, `website` and
    // `opening_hours.weekday_text` are gone.
    phone: data.nationalPhoneNumber ?? null,
    website: data.websiteUri ?? null,
    openingHours: data.regularOpeningHours?.weekdayDescriptions ?? null,
    rating: data.rating ?? null,
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
  // Exported for the tests. Translating Google's response is where this
  // migration can fail silently - a renamed field reads as `undefined` and
  // writes a plausible-looking row - so the mapping is checked directly
  // rather than only through a mocked HTTP call.
  toLocation,
  withinRadius,
};

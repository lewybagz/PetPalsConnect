const Location = require("../models/Location");
const places = require("../services/places");
const { milesBetween, formatMiles } = require("../services/matching/distance");
const { CATEGORIES, CARE_CATEGORIES } = require("../services/placeCategories");
const { EMERGENCY_CONTACTS } = require("../services/petCare/emergency");

/**
 * Places to meet.
 *
 * The near-query wrote a PascalCase `GeoLocation` key against a schema with a
 * lowercase `geoLocation`; `strictQuery` is off, so it went to Mongo as-is and
 * `$nearSphere` ran against a field that does not exist. "Places near you"
 * returned nothing, on every request, and looked exactly like an empty
 * database - which it also was, since nothing ever created a row.
 */
const LocationController = {
  /**
   * Places, nearest first when a position is given.
   *
   * A public catalogue read: the same parks for everybody, holding nothing
   * personal. Listed as such in `services/authAudit.js`.
   */
  async getAllLocations(req, res) {
    const { lat, lng, range, userLat, userLng, category } = req.query;

    // `userLat`/`userLng` are what the older screens send.
    const latitude = lat ?? userLat;
    const longitude = lng ?? userLng;

    /**
     * `?category=vet` or `?category=vet,groomer`, and unfiltered without it.
     *
     * An unknown name is dropped rather than 400d: this is a catalogue read,
     * and a typo should narrow to nothing visible rather than fail the screen.
     * An all-unknown list would otherwise read as "no filter" and quietly
     * return parks to the vet list, so it filters on the empty set instead.
     */
    const requested = category
      ? String(category)
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : null;
    const categories = requested
      ? requested.filter((name) => CATEGORIES.includes(name))
      : null;

    try {
      const locations = await places.nearby({
        latitude,
        longitude,
        radiusMiles: range,
        categories,
      });

      const origin =
        Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
          ? [Number(longitude), Number(latitude)]
          : null;

      res.json(
        locations.map((location) => ({
          ...location,
          // In miles, for a screen that has to say "2 miles away" without
          // knowing that the stored order is [longitude, latitude].
          distanceMiles:
            origin && location.geoLocation?.coordinates
              ? formatMiles(milesBetween(origin, location.geoLocation.coordinates))
              : null,
        }))
      );
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * One place, with its contact details filled in.
   *
   * The Details lookup happens here rather than during the import because an
   * import covers five categories at twenty results each and a Details call
   * per result would be a hundred billed requests to populate a screen nobody
   * has opened. Here it is one request, only for a place somebody is actually
   * looking at, and the answer is cached on the row for a month.
   *
   * `withDetails` never throws and never blocks: a vet's address and a route
   * to it are useful without a phone number, and a missing key must not turn
   * opening a place into an error.
   */
  async getLocationById(req, res, next) {
    let location;
    try {
      location = await Location.findById(req.params.id);
      if (location == null) {
        return res.status(404).json({ message: "Cannot find location" });
      }
      await places.withDetails(location);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.location = location;
    next();
  },

  /**
   * Adds a place by hand.
   *
   * `placeId` is required - it is how a place is matched against Google's
   * catalogue and how the importer refreshes it - and was never set, so
   * creating a location always failed validation. `name` is new and required
   * for the same reason every screen renders one. `creator` is not a path on
   * this schema, so that key was silently dropped.
   */
  async createLocation(req, res) {
    const { name, address, placeId } = req.body;

    if (!name || !address || !placeId) {
      return res
        .status(400)
        .json({ message: "name, address and placeId are required" });
    }

    const coordinates = Array.isArray(req.body.coordinates)
      ? req.body.coordinates.map(Number)
      : null;

    const location = new Location({
      name,
      address,
      description: req.body.description,
      photo: req.body.photo,
      rating: req.body.rating,
      placeId,
      slug: req.body.slug,
      geoLocation:
        coordinates && coordinates.length === 2 && coordinates.every(Number.isFinite)
          ? { type: "Point", coordinates }
          : undefined,
    });

    try {
      const newLocation = await location.save();
      res.status(201).json(newLocation);
    } catch (err) {
      // The unique index on `placeId` is what stops an import filling the map
      // with the same park five times; a duplicate is not an error worth 400.
      if (err?.code === 11000) {
        const existing = await Location.findOne({ placeId });
        return res.status(200).json(existing);
      }
      res.status(400).json({ message: err.message });
    }
  },

  /**
   * The care hub's list: vets, shops, groomers and boarders near somebody.
   *
   * A thin wrapper over the same query the map uses, and deliberately so - it
   * is the same collection, the same geo index and the same distance
   * arithmetic. What it adds is a default: `/api/locations` with no category is
   * everything, which is right for the map and wrong for a hub, so this one
   * defaults to the care categories and never includes parks.
   *
   * `EMERGENCY_CONTACTS` rides along because it is the one part of the hub
   * that works with no location, no Google key and no rows in the database,
   * and it is the part somebody needs most urgently. A hub that shows nothing
   * at all on a fresh deployment is a hub nobody opens twice.
   */
  async getCarePlaces(req, res) {
    const { lat, lng, range, category } = req.query;

    const requested = category
      ? String(category)
          .split(",")
          .map((name) => name.trim())
          .filter((name) => CARE_CATEGORIES.includes(name))
      : CARE_CATEGORIES;

    try {
      const locations = await places.nearby({
        latitude: lat,
        longitude: lng,
        radiusMiles: range,
        categories: requested,
      });

      const origin =
        Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
          ? [Number(lng), Number(lat)]
          : null;

      res.json({
        locationKnown: Boolean(origin),
        // Said plainly, so a short list reads as "we have not imported your
        // area yet" rather than "there are no vets near you".
        importable: places.isEnabled(),
        emergency: EMERGENCY_CONTACTS,
        places: locations.map((location) => ({
          ...location,
          distanceMiles:
            origin && location.geoLocation?.coordinates
              ? formatMiles(milesBetween(origin, location.geoLocation.coordinates))
              : null,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Pulls nearby places from Google into the collection.
   *
   * Without this the map is empty on every fresh deployment, and an empty map
   * is indistinguishable from a broken one. Optional: no key and it reports 503
   * rather than failing the request in a way that looks like a bug.
   */
  async importNearby(req, res) {
    const { lat, lng, range } = req.query;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    try {
      const imported = await places.importNear({
        latitude: Number(lat),
        longitude: Number(lng),
        radiusMiles: Number(range) || 5,
      });

      res.json({ imported: imported.length });
    } catch (err) {
      res.status(err.status ?? 500).json({ message: err.message });
    }
  },
};

module.exports = LocationController;

const Location = require("../models/Location");
const places = require("../services/places");
const { milesBetween, formatMiles } = require("../services/matching/distance");

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
    const { lat, lng, range, userLat, userLng } = req.query;

    // `userLat`/`userLng` are what the older screens send.
    const latitude = lat ?? userLat;
    const longitude = lng ?? userLng;

    try {
      const locations = await places.nearby({
        latitude,
        longitude,
        radiusMiles: range,
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

  async getLocationById(req, res, next) {
    let location;
    try {
      location = await Location.findById(req.params.id);
      if (location == null) {
        return res.status(404).json({ message: "Cannot find location" });
      }
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

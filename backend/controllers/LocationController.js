const Location = require("../models/Location");

const LocationController = {
  async getAllLocations(req, res) {
    try {
      const { range, userLat, userLng } = req.query; // Assuming latitude and longitude are passed as query parameters
      let query = {};

      if (range && userLat && userLng) {
        const userCoords = [parseFloat(userLng), parseFloat(userLat)]; // MongoDB expects longitude first, then latitude
        const rangeInMeters = parseFloat(range) * 1609.34; // Convert miles to meters

        query = {
          GeoLocation: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: userCoords,
              },
              $maxDistance: rangeInMeters,
            },
          },
        };
      }

      const locations = await Location.find(query).populate("Creator");
      res.json(locations);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getLocationById(req, res, next) {
    let location;
    try {
      location = await Location.findById(req.params.id).populate("Creator");
      if (location == null) {
        return res.status(404).json({ message: "Cannot find location" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.location = location;
    next();
  },

  async createLocation(req, res) {
    const location = new Location({
      address: req.body.address,
      description: req.body.description,
      photo: req.body.photo,
      rating: req.body.rating,
      reviews: req.body.reviews,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newLocation = await location.save();
      res.status(201).json(newLocation);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = LocationController;

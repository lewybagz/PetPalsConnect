require("dotenv").config();
const axios = require("axios");
const Location = require("../models/Location");
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const LocationController = {
  async getAllLocations(req, res) {
    try {
      const { range, userLat, userLng } = req.query;
      let query = {};

      if (range && userLat && userLng) {
        const userCoords = [parseFloat(userLng), parseFloat(userLat)];
        const rangeInMeters = parseFloat(range) * 1609.34;

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

  async updateLocations() {
    const placesApiUrl =
      "https://maps.googleapis.com/maps/api/place/details/json";
    const storedLocations = await Location.find({}, "placeId");
    try {
      // Here you should have an array of place IDs to update, fetched from your database or other source
      const placeIds = storedLocations.map((location) => location.placeId);

      // Fetch and update each place by its ID
      for (const placeId of placeIds) {
        const response = await axios.get(placesApiUrl, {
          params: {
            place_id: placeId,
            fields: "name,formatted_address,geometry", // Specify other fields you need
            key: GOOGLE_API_KEY,
          },
        });

        const placeDetails = response.data.result;

        // Convert the place details to your Location schema
        const locationData = {
          address: placeDetails.formatted_address,
          description: "", // Add any additional fields from placeDetails
          photo: "", // If available in the placeDetails
          rating: placeDetails.rating, // If available
          reviews: [], // If available
          creator: "", // Set the appropriate creator
          geoLocation: {
            type: "Point",
            coordinates: [
              // Ensure the order is [longitude, latitude]
              placeDetails.geometry.location.lng,
              placeDetails.geometry.location.lat,
            ],
          },
        };

        // Insert or update the location in your database
        const existingLocation = await Location.findOne({
          "geoLocation.coordinates": locationData.geoLocation.coordinates,
        });
        if (existingLocation) {
          await Location.findByIdAndUpdate(existingLocation._id, locationData);
        } else {
          await new Location(locationData).save();
        }
      }

      console.log("Locations updated successfully");
    } catch (err) {
      console.error("Error updating locations:", err);
      throw err; // Or handle this error appropriately
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

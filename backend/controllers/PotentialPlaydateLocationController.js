const PotentialPlaydateLocation = require("../models/PotentialPlaydateLocation");

const PotentialPlaydateLocationController = {
  // Create a new potential playdate location
  async createLocation(req, res) {
    const locationData = req.body;

    try {
      const newLocation = new PotentialPlaydateLocation(locationData);
      await newLocation.save();
      res.status(201).json(newLocation);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Retrieve all potential playdate locations
  async getAllLocations(req, res) {
    try {
      const locations = await PotentialPlaydateLocation.find();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Retrieve a specific location by ID
  async getLocationById(req, res) {
    try {
      const location = await PotentialPlaydateLocation.findById(req.params.id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update a location
  async updateLocation(req, res) {
    try {
      const location = await PotentialPlaydateLocation.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Delete a location
  async deleteLocation(req, res) {
    try {
      const location = await PotentialPlaydateLocation.findByIdAndDelete(
        req.params.id
      );
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = PotentialPlaydateLocationController;

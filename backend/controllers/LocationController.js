const Location = require("../models/Location");

const LocationController = {
  async getAllLocations(req, res) {
    try {
      const locations = await Location.find().populate("Creator");
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
      Address: req.body.Address,
      Description: req.body.Description,
      Photo: req.body.Photo,
      Rating: req.body.Rating,
      Reviews: req.body.Reviews,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
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

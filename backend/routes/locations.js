const express = require("express");
const router = express.Router();
const LocationController = require("../controllers/LocationController");

// GET all Locations
router.get("/playdate-locations", LocationController.getAllLocations); // Fetches all playdate locations

// GET a single Location by ID
router.get("/:id", LocationController.getLocationById, (req, res) => {
  res.json(res.location);
});

// POST a new Location
router.post("/", LocationController.createLocation);

module.exports = router;

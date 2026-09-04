const express = require("express");
const router = express.Router();
const LocationController = require("../controllers/LocationController");

// Static paths before the parameterised one, or `/:id` swallows them.

// Pulls nearby places in from Google, so a fresh deployment is not an empty map.
router.post("/import", LocationController.importNearby);

// Kept for the older screens, which ask for this path by name.
router.get("/playdate-locations", LocationController.getAllLocations);

// GET places, nearest first when `lat`/`lng` are given
router.get("/", LocationController.getAllLocations);

// POST a new Location
router.post("/", LocationController.createLocation);

// GET a single Location by ID
router.get("/:id", LocationController.getLocationById, (req, res) => {
  res.json(res.location);
});

module.exports = router;

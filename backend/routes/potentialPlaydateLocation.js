const express = require("express");
const router = express.Router();
const PotentialPlaydateLocationController = require("../controllers/PotentialPlaydateLocationController");

// Define routes
router.post(
  "/potential-playdate-locations",
  PotentialPlaydateLocationController.createLocation
);
router.get(
  "/potential-playdate-locations",
  PotentialPlaydateLocationController.getAllLocations
);
router.get(
  "/potential-playdate-locations/:id",
  PotentialPlaydateLocationController.getLocationById
);
router.put(
  "/potential-playdate-locations/:id",
  PotentialPlaydateLocationController.updateLocation
);
router.delete(
  "/potential-playdate-locations/:id",
  PotentialPlaydateLocationController.deleteLocation
);

module.exports = router;

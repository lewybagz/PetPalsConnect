const express = require("express");
const router = express.Router();
const TrackingController = require("../controllers/TrackingController");

// Mounted at /api/tracking, behind `authenticate`. A device reporting in uses
// /api/tracking/ingest, which is mounted separately in Server.js because a
// collar has no Firebase account.
router.get("/status", TrackingController.getStatus);

router.get("/devices", TrackingController.listDevices);
router.post("/devices", TrackingController.claimDevice);
router.patch("/devices/:deviceId", TrackingController.updateDevice);
router.delete("/devices/:deviceId", TrackingController.removeDevice);

router.get("/shares", TrackingController.listShares);
// Everything the caller may see right now, for the map layer.
router.get("/map", TrackingController.mapCollars);

// Every position read goes through visibility.canView inside the handler.
router.get("/pets/:petId/positions", TrackingController.getPetPositions);
router.post("/pets/:petId/shares", TrackingController.sharePet);
router.delete("/pets/:petId/shares/:userId", TrackingController.unsharePet);

module.exports = router;

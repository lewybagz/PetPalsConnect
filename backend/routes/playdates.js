const express = require("express");
const router = express.Router();
const PlaydateController = require("../controllers/PlaydateController");

// GET all Playdates
router.get("/", PlaydateController.getAllPlaydates);

// GET a single Playdate by ID
router.get("/:id", PlaydateController.getPlaydateById);

// POST a new Playdate
router.post("/", PlaydateController.createPlaydate);

// GET upcoming Playdates
router.get("/upcoming", PlaydateController.getUpcomingPlaydates);

router.get(
  "/playdates/locations/:placeId",
  PlaydateController.getLocationDetails
);

// POST to accept a Playdate request
router.post("/accept/:playdateId", PlaydateController.acceptPlaydate);

// POST to decline a Playdate request
router.post("/decline/:playdateId", PlaydateController.declinePlaydate);

module.exports = router;

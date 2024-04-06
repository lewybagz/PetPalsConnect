const express = require("express");
const router = express.Router();
const PlaydateController = require("../controllers/PlaydateController");

// GET all Playdates
router.get("/", PlaydateController.getAllPlaydates);

// GET a single Playdate by ID
router.get("/:id", PlaydateController.getPlaydateById);

// GET upcoming Playdates
router.get("/upcoming", PlaydateController.getUpcomingPlaydates);

router.get("/locations/:placeId", PlaydateController.getLocationDetails);

// POST a new Playdate
router.post("/", PlaydateController.createPlaydate);

// POST to accept a Playdate request
router.post("/accept/:playdateId", PlaydateController.acceptPlaydate);

// POST to decline a Playdate request
router.post("/decline/:playdateId", PlaydateController.declinePlaydate);

// Route to handle cancelling a playdate
router.patch("/:playdateId/cancel/:userId", PlaydateController.cancelPlaydate);

// UPDATE a Playdate by ID
router.patch("/update/:playdateId", PlaydateController.cancelPlaydate);

module.exports = router;

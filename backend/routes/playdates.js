const express = require("express");
const router = express.Router();
const PlaydateController = require("../controllers/PlaydateController");
const Playdate = require("../models/Playdate"); // Adjust the path according to your structure
const sendPushNotification = require("../services/notificationService"); // Path to your notification sending service

// GET all Playdates
router.get("/", PlaydateController.getAllPlaydates);

// GET a single Playdate by ID
router.get("/:id", PlaydateController.getPlaydateById);

// POST a new Playdate
router.post("/", PlaydateController.createPlaydate);

// GET upcoming Playdates
router.get("/upcoming", PlaydateController.getUpcomingPlaydates);

// POST to accept a Playdate request
router.post("/accept/:playdateId", PlaydateController.acceptPlaydate);

// POST to decline a Playdate request
router.post("/decline/:playdateId", PlaydateController.declinePlaydate);

module.exports = router;

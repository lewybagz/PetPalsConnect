const express = require("express");
const router = express.Router();
const EventController = require("../controllers/EventController");

// GET all Events
router.get("/", EventController.getAllEvents);

// GET a single Event by ID
router.get("/:id", EventController.getEventById, (req, res) => {
  res.json(res.event);
});

// POST a new Event
router.post("/", EventController.createEvent);

module.exports = router;

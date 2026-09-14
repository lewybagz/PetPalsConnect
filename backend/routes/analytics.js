const express = require("express");
const router = express.Router();
const AnalyticsController = require("../controllers/AnalyticsController");
const { requireModerator } = require("../services/moderation");

// Mounted at /api/analytics.
//
// Not `/api/events`: that mount is taken by `Event`, an unrelated calendar
// model. Two meanings of "event" on one path is how a router ends up answering
// the wrong question - and `Event` already has a `/:id` that would have
// swallowed anything added beside it.
//
// There is no `/:id` here and deliberately so: an individual event is not
// something anybody reads back. It is only ever counted.
router.get("/funnel", requireModerator, AnalyticsController.funnel);
router.post("/events", AnalyticsController.record);

module.exports = router;

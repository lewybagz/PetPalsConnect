const express = require("express");
const router = express.Router();
const limits = require("../middleware/rateLimits");
const PublicWaitlistController = require("../controllers/PublicWaitlistController");

// Mounted at /api/waitlist/public, outside `authenticate`. See Server.js for
// why. Rate limited here rather than at the mount so the limit travels with
// the route rather than depending on a mount line staying in the right order.
router.post("/", limits.publicWaitlist, PublicWaitlistController.join);

module.exports = router;

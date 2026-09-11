const express = require("express");
const router = express.Router();
const WaitlistController = require("../controllers/WaitlistController");

// Mounted at /api/waitlist.
router.get("/me", WaitlistController.me);
router.post("/", WaitlistController.join);

module.exports = router;

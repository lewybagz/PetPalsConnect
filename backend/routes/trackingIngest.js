const express = require("express");
const router = express.Router();
const TrackingController = require("../controllers/TrackingController");
const limits = require("../middleware/rateLimits");

/**
 * Where a collar reports in.
 *
 * Mounted at /api/tracking/ingest, outside `authenticate`: the caller is a
 * device or a vendor's cloud, not a person, and it proves itself with the
 * per-device secret the controller checks. Rate limited per serial rather
 * than per account, because there is no account - and per address would let
 * one flooding collar take out every other one behind the same carrier NAT.
 */
router.post("/", limits.ingest, TrackingController.ingest);

module.exports = router;

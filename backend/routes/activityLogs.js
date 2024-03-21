const express = require("express");
const router = express.Router();
const ActivityLogController = require("../controllers/ActivityLogController");

// GET all Activity Logs
router.get("/", ActivityLogController.getAllActivityLogs);

// GET a single Activity Log by ID
router.get("/:id", ActivityLogController.getActivityLogById, (req, res) => {
  res.json(res.activityLog);
});

// POST a new Activity Log
router.post("/", ActivityLogController.createActivityLog);

module.exports = router;

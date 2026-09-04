const express = require("express");
const router = express.Router();
const ReportController = require("../controllers/ReportController");
const { requireModerator } = require("../services/moderation");

// GET the reports the caller filed
router.get("/", ReportController.getAllReports);

// POST a new Report
router.post("/", ReportController.createReport);

// Static paths before the parameterised one, or `/:id` swallows them.
router.get("/options", ReportController.getReportOptions);
router.get("/queue", requireModerator, ReportController.getReportQueue);
router.patch("/:id/status", requireModerator, ReportController.updateReportStatus);

// GET a single Report by ID
router.get("/:id", ReportController.getReportById, (req, res) => {
  res.json(res.report);
});

module.exports = router;

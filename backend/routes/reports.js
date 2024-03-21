const express = require("express");
const router = express.Router();
const ReportController = require("../controllers/ReportController");

// GET all Reports
router.get("/", ReportController.getAllReports);

// GET a single Report by ID
router.get("/:id", ReportController.getReportById, (req, res) => {
  res.json(res.report);
});

// POST a new Report
router.post("/", ReportController.createReport);

module.exports = router;

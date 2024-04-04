const Report = require("../models/Report");

const ReportController = {
  async getAllReports(req, res) {
    try {
      const reports = await Report.find()
        .populate("reportedUser")
        .populate("reporter")
        .populate("creator");
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getReportById(req, res, next) {
    let report;
    try {
      report = await Report.findById(req.params.id)
        .populate("reportedUser")
        .populate("reporter")
        .populate("creator");
      if (report == null) {
        return res.status(404).json({ message: "Cannot find report" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.report = report;
    next();
  },

  async createReport(req, res) {
    const report = new report({
      content: req.body.content,
      reportedContent: req.body.reportedContent,
      reportedUser: req.body.reportedUser,
      reporter: req.body.reporter,
      status: req.body.status,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newReport = await report.save();
      res.status(201).json(newReport);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ReportController;

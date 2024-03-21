const Report = require("../models/Report");

const ReportController = {
  async getAllReports(req, res) {
    try {
      const reports = await Report.find()
        .populate("ReportedUser")
        .populate("Reporter")
        .populate("Creator");
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getReportById(req, res, next) {
    let report;
    try {
      report = await Report.findById(req.params.id)
        .populate("ReportedUser")
        .populate("Reporter")
        .populate("Creator");
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
    const report = new Report({
      Content: req.body.Content,
      ReportedContent: req.body.ReportedContent,
      ReportedUser: req.body.ReportedUser,
      Reporter: req.body.Reporter,
      Status: req.body.Status,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
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

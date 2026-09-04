const Report = require("../models/Report");

const ReportController = {
  async getAllReports(req, res) {
    try {
      // Moderation data. Unfiltered, this told anyone with an account who had
      // reported whom, and for what.
      const reports = await Report.find({ reporter: req.userId })
        .populate("reportedUser", "username")
        .sort({ timestamp: -1 });
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
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any report by guessing or harvesting an id.
      if (String(report.reporter?._id ?? report.reporter) !== String(req.userId)) {
        return res.status(404).json({ message: "Cannot find report" });
      }

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.report = report;
    next();
  },

  async createReport(req, res) {
    // `new report(...)` referenced the `const report` being declared on that
    // same line - a TDZ error on every call, thrown outside the try below, so
    // filing a report has always failed. The model is `Report`.
    const report = new Report({
      content: req.body.content,
      reportedContent: req.body.reportedContent,
      reportedUser: req.body.reportedUser,
      // Identity comes from the verified token, never the request body.
      reporter: req.userId,
      // A new report is always pending; the client does not get to set it.
      status: "pending",
      creator: req.userId,
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

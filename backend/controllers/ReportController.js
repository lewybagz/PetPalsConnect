const Report = require("../models/Report");
const moderation = require("../services/moderation");
const {
  REPORT_REASONS,
  REPORT_TARGETS,
  REPORT_STATUSES,
} = require("../services/reportStates");

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

  /** The vocabulary the report form renders. One source, so it cannot drift. */
  getReportOptions(req, res) {
    res.json({ reasons: REPORT_REASONS, targets: REPORT_TARGETS });
  },

  /**
   * The queue, for a moderator.
   *
   * The one list in the app that deliberately crosses users. It is safe only
   * because its route carries `requireModerator`, which lives in another file -
   * so `GUARDED_READS` in `services/authAudit.js` checks that the guard is
   * still there rather than trusting it.
   */
  async getReportQueue(req, res) {
    const status = String(req.query.status ?? "pending");

    if (!REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Unknown status: ${status}` });
    }

    try {
      const reports = await Report.find({ status })
        .populate("reportedUser", "username userPhoto suspended")
        .populate("reporter", "username")
        .sort({ timestamp: 1 })
        .limit(100);
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Moves a report along its state machine. Moderators only. */
  async updateReportStatus(req, res) {
    const { status, resolution } = req.body;

    if (!REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Unknown status: ${status}` });
    }

    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Cannot find report" });
      }

      const result = await moderation.transitionReport({
        report,
        to: status,
        resolution,
        moderatorId: req.userId,
      });

      if (!result.ok) {
        return res.status(409).json({ message: result.message });
      }

      res.json(result.report);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getReportById(req, res, next) {
    let report;
    try {
      report = await Report.findById(req.params.id)
        .populate("reportedUser", "username userPhoto")
        .populate("reporter", "username");
      if (report == null) {
        return res.status(404).json({ message: "Cannot find report" });
      }
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any report by guessing or harvesting an id.
      if (
        String(report.reporter?._id ?? report.reporter) !== String(req.userId) &&
        !moderation.isModerator(req.user)
      ) {
        return res.status(404).json({ message: "Cannot find report" });
      }

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.report = report;
    next();
  },

  /**
   * Files a report, and blocks the person it is about.
   *
   * `new report(...)` referenced the `const report` being declared on that
   * same line - a TDZ error on every call, thrown outside the try below, so
   * filing a report has always failed. Identity comes from the verified token,
   * never the request body, and the status is always `pending`: a client that
   * could set its own status could file a report already marked dismissed.
   */
  async createReport(req, res) {
    const reportedUser = req.body.reportedUser ?? req.body.userId;
    const content = String(req.body.content ?? "").trim();

    if (!content) {
      return res.status(400).json({ message: "Tell us what happened" });
    }
    if (!reportedUser && !req.body.reportedContent) {
      return res.status(400).json({ message: "reportedUser is required" });
    }

    const reason = REPORT_REASONS.includes(req.body.reason)
      ? req.body.reason
      : "other";
    const reportedContentType = REPORT_TARGETS.includes(req.body.reportedContentType)
      ? req.body.reportedContentType
      : "user";

    try {
      const { report, blocked, suspended } = await moderation.fileReport({
        reporterId: req.userId,
        reportedUserId: reportedUser,
        reportedContent: req.body.reportedContent,
        reportedContentType,
        reason,
        content,
      });

      res.status(201).json({ report, blocked, suspended });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ReportController;

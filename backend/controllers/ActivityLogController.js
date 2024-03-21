const ActivityLog = require("../models/ActivityLog");

const ActivityLogController = {
  async getAllActivityLogs(req, res) {
    try {
      const activityLogs = await ActivityLog.find()
        .populate("User")
        .populate("Creator");
      res.json(activityLogs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getActivityLogById(req, res, next) {
    let activityLog;
    try {
      activityLog = await ActivityLog.findById(req.params.id);
      if (activityLog == null) {
        return res.status(404).json({ message: "Cannot find activity log" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.activityLog = activityLog;
    next();
  },

  async createActivityLog(req, res) {
    const activityLog = new ActivityLog({
      ActionDetails: req.body.ActionDetails,
      ActionType: req.body.ActionType,
      User: req.body.User,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newActivityLog = await activityLog.save();
      res.status(201).json(newActivityLog);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ActivityLogController;

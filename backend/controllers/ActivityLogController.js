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
    // Every key here was PascalCase against a lowercase schema, so strict mode
    // dropped all five and the save failed on four required fields. No
    // activity log this app tried to write has ever been stored.
    const activityLog = new ActivityLog({
      actionDetails: req.body.actionDetails,
      actionType: req.body.actionType,
      user: req.userId,
      creator: req.userId,
      slug: req.body.slug,
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

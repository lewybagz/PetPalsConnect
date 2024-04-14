const UserPreferences = require("../models/UserPreferences");

const UserPreferencesController = {
  async getAllUserPreferences(req, res) {
    try {
      const userPreferences = await UserPreferences.find()
        .populate("user")
        .populate("creator");
      res.json(userPreferences);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserPreferences(req, res) {
    try {
      const userPreferences = await UserPreferences.findOne({
        user: req,
      });
      if (!userPreferences) {
        return res.status(404).json({ message: "User preferences not found" });
      }
      res.json({ notificationsEnabled: userPreferences.notificationsEnabled });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getUserPreferencesById(req, res, next) {
    let userPreferences;
    try {
      userPreferences = await UserPreferences.findById(req.params.id)
        .populate("user")
        .populate("creator");
      if (userPreferences == null) {
        return res
          .status(404)
          .json({ message: "Cannot find user preferences" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.userPreferences = userPreferences;
    next();
  },

  async createUserPreferences(req, res) {
    const userPreferences = new UserPreferences({
      notificationSettings: req.body.notificationSettings,
      searchSettings: req.body.searchSettings,
      user: req.body.user,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newUserPreferences = await userPreferences.save();
      res.status(201).json(newUserPreferences);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async muteAllNotifications(req, res) {
    try {
      const userPreferences = await UserPreferences.findOne({
        user: req.userId,
      });

      if (!userPreferences) {
        return res.status(404).json({ message: "User preferences not found" });
      }

      userPreferences.notificationPreferences.petPalsMapUpdates = false;
      userPreferences.notificationPreferences.playdateReminders = false;
      userPreferences.notificationPreferences.appUpdates = false;
      userPreferences.notificationPreferences.pushNotificationsEnabled = false;
      userPreferences.notificationPreferences.emailNotificationsEnabled = false;

      await userPreferences.save();
      res.status(200).json({
        message: "All notifications have been muted",
        userPreferences,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async updateUserPreferences(req, res) {
    if (req.body.notificationSettings != null) {
      res.userPreferences.notificationSettings = req.body.notificationSettings;
    }
    if (req.body.searchSettings != null) {
      res.userPreferences.searchSettings = req.body.searchSettings;
    }
    if (req.body.user != null) {
      res.userPreferences.user = req.body.user;
    }
    if (req.body.modifiedDate != null) {
      res.userPreferences.modifiedDate = req.body.modifiedDate;
    }

    try {
      const updatedUserPreferences = await res.userPreferences.save();
      res.json(updatedUserPreferences);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = UserPreferencesController;

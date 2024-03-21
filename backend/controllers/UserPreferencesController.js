const UserPreferences = require("../models/UserPreferences");

const UserPreferencesController = {
  async getAllUserPreferences(req, res) {
    try {
      const userPreferences = await UserPreferences.find()
        .populate("User")
        .populate("Creator");
      res.json(userPreferences);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserPreferencesById(req, res, next) {
    let userPreferences;
    try {
      userPreferences = await UserPreferences.findById(req.params.id)
        .populate("User")
        .populate("Creator");
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
      NotificationSettings: req.body.NotificationSettings,
      SearchSettings: req.body.SearchSettings,
      User: req.body.User,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newUserPreferences = await userPreferences.save();
      res.status(201).json(newUserPreferences);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async updateUserPreferences(req, res) {
    if (req.body.NotificationSettings != null) {
      res.userPreferences.NotificationSettings = req.body.NotificationSettings;
    }
    if (req.body.SearchSettings != null) {
      res.userPreferences.SearchSettings = req.body.SearchSettings;
    }
    if (req.body.User != null) {
      res.userPreferences.User = req.body.User;
    }
    if (req.body.ModifiedDate != null) {
      res.userPreferences.ModifiedDate = req.body.ModifiedDate;
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

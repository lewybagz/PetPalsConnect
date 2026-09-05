const UserPreferences = require("../models/UserPreferences");
const { CATEGORIES } = require("../services/notificationTypes");
const { timeOfDay } = require("../services/settings");

/**
 * Notification preferences.
 *
 * Nothing here worked. `getUserPreferences` did
 * `UserPreferences.findOne({ user: req })` - the whole Express request object
 * where a user id goes - so it 404'd on every call and the `:userId` in the
 * path was never read. `getUserPreferencesById` did `findById` on that same
 * *user* id, looking for a preferences document with a user's `_id`, which
 * also never matched. Create and update wrote `notificationSettings` and
 * `searchSettings`, neither of which is a path on the schema, so strict mode
 * dropped both and a "saved" preference was a document of defaults.
 *
 * And the screen behind it - `NotificationPreferencesScreen` - held two
 * toggles in component state with a comment where the save should be, so
 * turning notifications off did nothing at all and said it had.
 *
 * Preferences are read-through: the first read creates the row from the
 * schema's defaults rather than 404ing, because a settings screen that cannot
 * open until something has been saved has nothing to save from.
 */

/** The caller's preferences, created from defaults on first read. */
const forUser = async (userId) => {
  const existing = await UserPreferences.findOne({ user: userId });
  if (existing) return existing;

  return UserPreferences.create({ user: userId });
};

/**
 * The hours somebody would rather not be woken.
 *
 * A partial patch, like the switches beside it: the screen sends the end that
 * moved. The times are validated with the same `timeOfDay` the account settings
 * use, so "7pm" is a 400 rather than a window that silently never opens.
 *
 * The offset comes from the device (`-new Date().getTimezoneOffset()`) because
 * the window is wall-clock: "22:00" means ten at night wherever its owner is
 * standing, and storing an instant would get it wrong for exactly the person it
 * exists for - the one who has just landed somewhere else and would like to
 * sleep.
 */
const applyQuietHours = (preferences, incoming) => {
  const allowed = ["enabled", "start", "end", "utcOffsetMinutes"];

  for (const [key, value] of Object.entries(incoming)) {
    if (!allowed.includes(key)) {
      const error = new Error(`"quietHours.${key}" is not a preference`);
      error.status = 400;
      throw error;
    }

    if (key === "enabled") preferences.quietHours.enabled = Boolean(value);
    else if (key === "utcOffsetMinutes") {
      const offset = Number(value);
      if (!Number.isFinite(offset) || offset < -840 || offset > 840) {
        const error = new Error("quietHours.utcOffsetMinutes is out of range");
        error.status = 400;
        throw error;
      }
      preferences.quietHours.utcOffsetMinutes = offset;
    } else preferences.quietHours[key] = timeOfDay(value, `quietHours.${key}`);
  }
};

const UserPreferencesController = {
  forUser,

  async getAllUserPreferences(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours.
      const userPreferences = await UserPreferences.find({ user: req.userId });
      res.json(userPreferences);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * The caller's own preferences.
   *
   * The `:userId` in the path is checked against the token rather than
   * trusted: it named whose settings to fetch, and settings include what
   * somebody has chosen to be quiet about.
   */
  async getUserPreferences(req, res) {
    const { userId } = req.params;

    if (userId && userId !== "me" && String(userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not your preferences" });
    }

    try {
      res.json(await forUser(req.userId));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Turns everything off in one tap. */
  async muteAllNotifications(req, res) {
    const { userId } = req.params;

    if (userId && userId !== "me" && String(userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not your preferences" });
    }

    try {
      const preferences = await forUser(req.userId);

      for (const key of Object.keys(
        preferences.notificationPreferences.toObject
          ? preferences.notificationPreferences.toObject()
          : preferences.notificationPreferences
      )) {
        preferences.notificationPreferences[key] = false;
      }
      preferences.modifiedDate = new Date();

      await preferences.save();
      res.status(200).json(preferences);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createUserPreferences(req, res) {
    try {
      // One row per account, so asking twice is not an error worth showing.
      res.status(201).json(await forUser(req.userId));
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  /**
   * Changes some of them.
   *
   * A merge rather than a replace: the screen sends the toggle that moved, and
   * a replace would reset every other preference to its default each time
   * somebody flipped one.
   */
  async updateUserPreferences(req, res) {
    const { userId } = req.params;

    if (userId && userId !== "me" && String(userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not your preferences" });
    }

    const incoming =
      req.body.notificationPreferences ?? req.body.notificationSettings ?? {};

    try {
      const preferences = await forUser(req.userId);

      if (req.body.quietHours) {
        applyQuietHours(preferences, req.body.quietHours);
      }

      for (const [key, value] of Object.entries(incoming)) {
        // Anything not on the schema would be dropped silently, which is how
        // this failed before. Refuse it instead.
        if (!(key in preferences.notificationPreferences)) {
          return res
            .status(400)
            .json({ message: `"${key}" is not a notification preference` });
        }
        preferences.notificationPreferences[key] = Boolean(value);
      }

      preferences.modifiedDate = new Date();
      await preferences.save();

      res.json(preferences);
    } catch (err) {
      res
        .status(err.status ?? 400)
        .json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    }
  },

  /** The categories a notification type can fall under, for the screen. */
  async getCategories(req, res) {
    res.json({ categories: CATEGORIES });
  },
};

module.exports = UserPreferencesController;

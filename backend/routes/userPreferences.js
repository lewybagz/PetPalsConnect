const express = require("express");
const router = express.Router();
const UserPreferencesController = require("../controllers/UserPreferencesController");

// Mounted at /api/userpreferences.
// "/:id" and "/:userId" were both registered for GET; the first always won, so
// getUserPreferences was dead code. Preferences are addressed by user id.
router.get("/", UserPreferencesController.getAllUserPreferences);
router.post("/", UserPreferencesController.createUserPreferences);

router.patch(
  "/:userId/mute-all",
  UserPreferencesController.muteAllNotifications
);
router.get("/:userId", UserPreferencesController.getUserPreferences);
router.put(
  "/:userId",
  UserPreferencesController.getUserPreferencesById,
  UserPreferencesController.updateUserPreferences
);
router.patch(
  "/:userId",
  UserPreferencesController.getUserPreferencesById,
  UserPreferencesController.updateUserPreferences
);

module.exports = router;

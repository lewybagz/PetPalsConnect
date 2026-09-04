const express = require("express");
const router = express.Router();
const UserPreferencesController = require("../controllers/UserPreferencesController");

// Mounted at /api/userpreferences.
//
// Preferences belong to exactly one account, so every route here resolves to
// the caller's own; the `:userId` forms remain because two screens address
// them that way, and they now check the id against the token rather than
// trusting it.
//
// Static paths before parameterised ones: Express matches in registration
// order, so "/:userId" would otherwise swallow "/me" and "/categories".
router.get("/", UserPreferencesController.getAllUserPreferences);
router.get("/categories", UserPreferencesController.getCategories);
router.get("/me", UserPreferencesController.getUserPreferences);
router.patch("/me", UserPreferencesController.updateUserPreferences);
router.post("/", UserPreferencesController.createUserPreferences);

router.patch("/:userId/mute-all", UserPreferencesController.muteAllNotifications);
router.get("/:userId", UserPreferencesController.getUserPreferences);
router.put("/:userId", UserPreferencesController.updateUserPreferences);
router.patch("/:userId", UserPreferencesController.updateUserPreferences);

module.exports = router;

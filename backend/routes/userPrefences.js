const express = require("express");
const router = express.Router();
const UserPreferencesController = require("../controllers/UserPreferencesController");

// GET all UserPreferences
router.get("/", UserPreferencesController.getAllUserPreferences);

// GET a single UserPreferences by ID
router.get(
  "/:id",
  UserPreferencesController.getUserPreferencesById,
  (req, res) => {
    res.json(res.userPreferences);
  }
);

router.get("/:userId", UserPreferencesController.getUserPreferences);

// POST a new UserPreferences
router.post("/", UserPreferencesController.createUserPreferences);

// PUT to update UserPreferences
router.put(
  "/:id",
  UserPreferencesController.getUserPreferencesById,
  UserPreferencesController.updateUserPreferences
);

module.exports = router;

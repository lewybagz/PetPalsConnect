const express = require("express");
const UserController = require("../controllers/UserController");
const { requireProfile } = require("../middleware/authenticate");

const router = express.Router();

/**
 * Mounted at /api/users.
 *
 * Two things were wrong here before:
 *
 * 1. Several paths repeated the mount prefix ("/users/pets/:petId" resolved to
 *    /api/users/users/pets/:petId) or used a singular "/user/..." segment the
 *    mount never had. Those endpoints were unreachable.
 * 2. "/:id" was declared near the top, so it matched literal segments like
 *    "me" and "settings" before their own handlers were reached.
 *
 * Static paths are therefore declared first, parameterised ones last.
 */

// --- The signed-in caller -------------------------------------------------
router.get("/me", UserController.getCurrentUser);
router.post("/", UserController.createUser); // Firebase account -> Mongo profile

// --- Settings (all act on the caller) -------------------------------------
router.post("/settings", requireProfile, UserController.updateUserSettings);
router.post(
  "/settings/2fa",
  requireProfile,
  UserController.updateTwoFactorAuthentication
);
router.post(
  "/settings/security-question",
  requireProfile,
  UserController.updateSecurityQuestion
);
router.post(
  "/settings/change-password",
  UserController.changeUserPassword // returns 410; Firebase owns credentials
);
router.post(
  "/notification-preferences",
  requireProfile,
  UserController.updateNotificationPreferences
);

// --- Collections ----------------------------------------------------------
router.get("/", UserController.getAllUsers);
router.get("/pets/:userId", UserController.getUserPets);
router.get("/favorites/:userId", UserController.getUserFavorites);
router.delete("/pets/:petId", requireProfile, UserController.deleteUserPet);

// --- Parameterised, declared last ----------------------------------------
router.patch(
  "/:userId/locationSharing",
  UserController.updateUserLocationSharing
);
router.get("/:id", UserController.getUserById, (req, res) => res.json(res.user));
router.put("/:id", UserController.getUserById, UserController.updateUser);
router.patch("/:id", UserController.getUserById, UserController.updateUser);
router.delete("/:id", UserController.getUserById, UserController.deleteUser);

module.exports = router;

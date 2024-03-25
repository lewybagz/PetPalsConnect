const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");

// GET all Users
router.get("/", UserController.getAllUsers);

// GET a single User by ID
router.get("/:id", UserController.getUserById, (req, res) => {
  res.json(res.user);
});

router.get("/pets/:userId", UserController.getUserPets);

router.patch(
  "/:userId/locationSharing",
  UserController.updateUserLocationSharing
);

router.patch("/users/:userId", UserController.updateUser);

router.post("/user/settings/2fa", UserController.updateTwoFactorAuthentication);

// POST a new User
router.post("/", UserController.createUser);

// Route for password change
router.post(
  "/user/settings/change-password",
  UserController.changeUserPassword
);

// Route for security question update
router.post(
  "/user/settings/security-question",
  UserController.updateSecurityQuestion
);

// UPDATE a User by ID
router.put("/:id", UserController.getUserById, UserController.updateUser);

router.post("/user/settings", UserController.updateUserSettings);

router.delete("/users/pets/:petId", UserController.deleteUserPet);

// DELETE a User
router.delete("/:id", UserController.getUserById, UserController.deleteUser);

module.exports = router;

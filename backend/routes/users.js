const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");

// GET all Users
router.get("/", UserController.getAllUsers);

// GET a single User by ID
router.get("/:id", UserController.getUserById, (req, res) => {
  res.json(res.user);
});

router.patch(
  "/:userId/locationSharing",
  UserController.updateUserLocationSharing
);

// POST a new User
router.post("/", UserController.createUser);

// UPDATE a User by ID
router.put("/:id", UserController.getUserById, UserController.updateUser);

router.patch("/users/:userId", UserController.updateUser);

// DELETE a User
router.delete("/:id", UserController.getUserById, UserController.deleteUser);

module.exports = router;

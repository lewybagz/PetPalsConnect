const express = require("express");
const router = express.Router();
const UserController = require("../controllers/UserController");

// GET all Users
router.get("/", UserController.getAllUsers);

// GET a single User by ID
router.get("/:id", UserController.getUserById, (req, res) => {
  res.json(res.user);
});

router.patch("/:userId/locationSharing", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        locationSharingEnabled: req.body.locationSharingEnabled,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Location sharing preference updated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST a new User
router.post("/", UserController.createUser);

// UPDATE a User by ID
router.put("/:id", UserController.getUserById, UserController.updateUser);

// DELETE a User
router.delete("/:id", UserController.getUserById, UserController.deleteUser);

module.exports = router;

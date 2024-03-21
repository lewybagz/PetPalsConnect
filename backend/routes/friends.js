const express = require("express");
const router = express.Router();
const FriendController = require("../controllers/FriendController");

// GET all Friend relationships
router.get("/", FriendController.getAllFriends);

// GET a single Friend relationship by ID
router.get("/:id", FriendController.getFriendById, (req, res) => {
  res.json(res.friend);
});

// GET friends for a specific pet by petId
router.get("/pet/:petId", FriendController.getPetFriends);

// POST a new Friend relationship
router.post("/", FriendController.createFriend);

module.exports = router;

const express = require("express");
const router = express.Router();
const FriendController = require("../controllers/FriendController");

// GET all Friends
router.get("/", FriendController.getAllFriends);

// GET a single Friend by ID
router.get("/:id", FriendController.getFriendById, (req, res) => {
  res.json(res.friend);
});

// POST a new Friend
router.post("/", FriendController.createFriend);

// GET friends of a specific pet
router.get("/pet-friends/:petId", FriendController.getPetFriends);

module.exports = router;

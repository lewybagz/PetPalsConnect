const express = require("express");
const router = express.Router();
const FriendController = require("../controllers/FriendController");

// GET all Friend relationships
router.get("/", FriendController.getAllFriends);

// The pets of everyone the caller is friends with, for picking somebody to
// arrange a playdate with. Declared before "/:id" - Express matches in
// registration order, and the old ordering meant "/:id/pets" was reached with
// the id as a *pet* id, which is not what the handler wanted either.
router.get("/pets", FriendController.getPetFriends);

// GET a single Friend relationship by ID
router.get("/:id", FriendController.getFriendById, (req, res) => {
  res.json(res.friend);
});

// Friendships come from accepting a friend request; this reports 410.
router.post("/", FriendController.createFriend);

// Unfriend, addressed by the other person rather than by the row.
router.delete("/:userId", FriendController.removeFriend);

module.exports = router;

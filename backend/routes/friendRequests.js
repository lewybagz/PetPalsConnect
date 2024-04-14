const express = require("express");
const router = express.Router();
const FriendRequestController = require("../controllers/FriendRequestController");

router.get("/", FriendRequestController.getAllFriendRequests);
router.get("/:id", FriendRequestController.getFriendRequestById, (req, res) => {
  res.json(res.friendRequest);
});
router.post("/", FriendRequestController.createFriendRequest);

// Route to accept a friend request
router.put(
  "/friendrequests/:id/accept",
  FriendRequestController.acceptFriendRequest
);

// Route to decline a friend request
router.put(
  "/friendrequests/:id/decline",
  FriendRequestController.declineFriendRequest
);

router.put(
  "/:id",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.updateFriendRequest
);

module.exports = router;

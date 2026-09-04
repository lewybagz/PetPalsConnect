const express = require("express");
const router = express.Router();
const FriendRequestController = require("../controllers/FriendRequestController");

// Mounted at /api/friendrequests. The accept/decline paths previously repeated
// the mount prefix and were unreachable.
router.get("/", FriendRequestController.getAllFriendRequests);
router.post("/", FriendRequestController.createFriendRequest);

// Both handlers open with `if (!res.friendRequest)` and there was no loader in
// front of them, so accepting or declining a friend request answered "No
// friend request loaded" with a 404, every time, for everybody.
router.put(
  "/:id/accept",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.acceptFriendRequest
);
router.put(
  "/:id/decline",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.declineFriendRequest
);

router.get("/:id", FriendRequestController.getFriendRequestById, (req, res) => {
  res.json(res.friendRequest);
});
router.put(
  "/:id",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.updateFriendRequest
);

module.exports = router;

const express = require("express");
const router = express.Router();
const FriendRequestController = require("../controllers/FriendRequestController");

// Mounted at /api/friendrequests. The accept/decline paths previously repeated
// the mount prefix and were unreachable.
router.get("/", FriendRequestController.getAllFriendRequests);
router.post("/", FriendRequestController.createFriendRequest);

router.put("/:id/accept", FriendRequestController.acceptFriendRequest);
router.put("/:id/decline", FriendRequestController.declineFriendRequest);

router.get("/:id", FriendRequestController.getFriendRequestById, (req, res) => {
  res.json(res.friendRequest);
});
router.put(
  "/:id",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.updateFriendRequest
);

module.exports = router;

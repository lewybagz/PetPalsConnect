const express = require("express");
const router = express.Router();
const FriendRequestController = require("../controllers/FriendRequestController");

router.get("/", FriendRequestController.getAllFriendRequests);
router.get("/:id", FriendRequestController.getFriendRequestById, (req, res) => {
  res.json(res.friendRequest);
});
router.post("/", FriendRequestController.createFriendRequest);
router.put(
  "/:id",
  FriendRequestController.getFriendRequestById,
  FriendRequestController.updateFriendRequest
);

module.exports = router;

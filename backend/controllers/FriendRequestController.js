const FriendRequest = require("../models/FriendRequest");

const FriendRequestController = {
  async getAllFriendRequests(req, res) {
    try {
      const friendRequests = await FriendRequest.find()
        .populate("sender")
        .populate("receiver");
      res.json(friendRequests);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFriendRequestById(req, res, next) {
    try {
      const friendRequest = await FriendRequest.findById(req.params.id)
        .populate("sender")
        .populate("receiver");
      if (!friendRequest) {
        return res.status(404).json({ message: "Friend request not found" });
      }
      res.friendRequest = friendRequest;
      next();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createFriendRequest(req, res) {
    const { sender, receiver } = req.body;
    const newFriendRequest = new FriendRequest({
      sender,
      receiver,
      status: "pending", // default status
    });

    try {
      const savedFriendRequest = await newFriendRequest.save();
      res.status(201).json(savedFriendRequest);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async updateFriendRequest(req, res) {
    if (req.body.status) {
      res.friendRequest.status = req.body.status;
    }
    res.friendRequest.modifiedDate = Date.now();

    try {
      const updatedFriendRequest = await res.friendRequest.save();
      res.json(updatedFriendRequest);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = FriendRequestController;

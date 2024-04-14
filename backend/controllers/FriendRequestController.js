const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const Friend = require("../models/Friend");
const { sendPushNotification } = require("./NotificationController");
import { createNotification } from "../services/NotificationService";

async function updateFriendStatus(sender, receiver) {
  try {
    const friend = await Friend.findOne({ sender, receiver });
    if (friend) {
      friend.status = true;
      await friend.save();
    } else {
      console.log("Friend relationship not found.");
    }
  } catch (err) {
    console.error("Failed to update friend status:", err);
  }
}

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

  async acceptFriendRequest(req, res) {
    if (!res.friendRequest) {
      return res.status(404).json({ message: "No friend request loaded" });
    }
    if (res.friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Friend request is not in a pending state" });
    }

    try {
      const requester = await User.findById(res.friendRequest.sender).populate(
        "pets"
      );
      if (!requester) {
        console.log("Requester not found");
        return res.status(404).json({ message: "Requester not found" });
      }

      const petName = requester.pets[0]?.name || "Unknown Pet";
      const notificationData = {
        title: "Friend Request Accepted",
        body: `${petName} accepted your friend request!`,
        data: {
          type: "acceptance",
          petName: petName,
        },
      };

      res.friendRequest.status = "accepted";
      res.friendRequest.modifiedDate = Date.now();
      await res.friendRequest.save();

      await Promise.all([
        sendPushNotification(requester._id, notificationData),
        createNotification(requester._id, notificationData),
        updateFriendStatus(
          res.friendRequest.sender,
          res.friendRequest.receiver
        ),
      ]);

      res.status(200).json({ message: "Friend request accepted" });
    } catch (err) {
      console.error("Error accepting friend request:", err);
      res.status(500).json({ message: err.message });
    }
  },

  // Method to decline a friend request
  async declineFriendRequest(req, res) {
    try {
      if (!res.friendRequest) {
        return res.status(404).json({ message: "No friend request loaded" });
      }
      if (res.friendRequest.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Friend request is not in a pending state" });
      }

      res.friendRequest.status = "declined";
      res.friendRequest.modifiedDate = Date.now();
      await res.friendRequest.save();
      res.status(200).json({ message: "Friend request declined" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createFriendRequest(req, res) {
    const { sender, receiver } = req.body;
    const newFriendRequest = new FriendRequest({
      sender,
      receiver,
      status: "pending",
    });

    try {
      const savedFriendRequest = await newFriendRequest.save();
      const senderUser = await User.findById(sender).populate("pets");
      const receiverUser = await User.findById(receiver).populate("pets");

      const senderPetName = senderUser.pets[0]?.name || "Your pet";
      const receiverPetName = receiverUser.pets[0]?.name || "Your pet";

      const notificationData = {
        recipientUserId: receiver,
        title: "New Friend Request",
        message: `${senderPetName} wants to be friends with ${receiverPetName}! How pawesome is that?!`,
        data: {
          requestId: savedFriendRequest._id,
          senderId: sender,
          senderPetName: senderPetName,
        },
      };

      await Promise.all([
        sendPushNotification(notificationData),
        createNotification(notificationData),
      ]);

      res.status(201).json(savedFriendRequest);
    } catch (err) {
      console.error("Failed to create friend request:", err);
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

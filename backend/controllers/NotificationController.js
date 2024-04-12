const Notification = require("../models/Notification");
const Bull = require("bull");

const {
  findUserById,
} = require("../../PetPalsConnectApp/services/UserService");
const admin = require("firebase-admin");
const User = require("../models/User");
const serviceAccount = require("../config/serviceAccountKey.json");
const Playdate = require("../models/Playdate");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
export const findTokenByUserId = async (userId) => {
  try {
    const user = await User.findOne({ _id: userId });
    return user ? user.fcmToken : null;
  } catch (error) {
    console.error("Error finding user:", error);
    return null;
  }
};

export const findPlaydateById = async (playdateId) => {
  try {
    const playdate = await Playdate.findById(playdateId);
    return playdate;
  } catch (error) {
    console.error("Error finding playdate:", error);
    throw error;
  }
};

const NotificationController = {
  async getAllNotifications(req, res) {
    try {
      const notifications = await Notification.find()
        .populate("recipient")
        .populate("creator");
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserNotifications(req, res) {
    try {
      const userId = req.params.userId;
      const userNotifications = await Notification.find({ Recipient: userId })
        .populate("recipient")
        .populate("creator")
        .sort({ Timestamp: -1 });

      res.json(userNotifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getNotificationById(req, res) {
    try {
      const notification = await Notification.findById(req.params.id)
        .populate("recipient")
        .populate("creator");
      if (!notification) {
        return res.status(404).json({ message: "Cannot find notification" });
      }
      res.json(notification);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async sendFriendRequestNotification(req, res) {
    try {
      const { userId, requesterId } = req.body;

      const token = await findTokenByUserId(userId);
      if (!token) throw new Error("FCM token not found for user");

      const requester = await findUserById(requesterId);
      const requesterName = requester.name;

      const message = {
        token: token,
        notification: {
          title: "New Friend Request",
          body: `${requesterName} has sent you a friend request!`,
        },
      };

      await admin.messaging().send(message);
      res.json({ message: "Friend request notification sent successfully" });
    } catch (error) {
      console.log("Error sending friend request notification:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async fetchRecentNotifications(req, res) {
    try {
      const userId = req.user.id; // Adjust based on how you get the current user's ID
      const threshold = new Date(new Date().getTime() - 73 * 60 * 60 * 1000);

      const notifications = await Notification.find({
        user: userId,
        createdAt: { $gte: threshold },
      }).sort({ createdAt: -1 });

      res.status(200).json(notifications);
    } catch (error) {
      console.error("Error fetching recent notifications:", error);
      res.status(500).json({ message: "Error fetching notifications", error });
    }
  },

  async createNotification(req, res) {
    const notification = new Notification({
      content: req.body.content,
      readStatus: req.body.readStatus,
      recipient: req.body.recipient,
      type: req.body.type,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newNotification = await notification.save();
      res.status(201).json(newNotification);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

export const sendPushNotification = async (userId, notificationData) => {
  try {
    const token = await findTokenByUserId(userId);
    if (!token) throw new Error("FCM token not found for user");

    const message = {
      token: token,
      notification: {
        title: notificationData.title,
        body: notificationData.body,
      },
      data: notificationData.data,
    };

    await admin.messaging().send(message);
    console.log("Successfully sent message");
  } catch (error) {
    console.log("Error sending message:", error);
    throw error;
  }
};

export const sendPlaydateNotification = async (req, res) => {
  try {
    const { to, title, body, data } = req.body;
    await sendPushNotification(to, { title, body, data });
    res.json({ message: "Notification sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const notificationQueue = new Bull("notificationQueue");

export const pushPlaydateReviewReminderNotification = async (
  playdateId,
  userId
) => {
  try {
    const playdate = await findPlaydateById(playdateId);
    if (!playdate) throw new Error("Playdate not found");

    const delay =
      new Date(playdate.startTime).getTime() + 60 * 60 * 1000 - Date.now();

    if (delay > 0) {
      notificationQueue.add(
        {
          userId: userId,
          playdateId: playdateId,
        },
        { delay: delay }
      );
    }
  } catch (error) {
    console.error("Error scheduling playdate review reminder:", error);
    throw error;
  }
};

exports.saveDeviceToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }
    );

    res.status(200).json({
      message: "Device token saved successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error saving device token:", error);
    res.status(500).json({ message: "Failed to save device token", error });
  }
};
module.exports = NotificationController;

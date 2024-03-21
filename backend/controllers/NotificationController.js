const Notification = require("../models/Notification");
const admin = require("firebase-admin");
const User = require("../models/User");
const serviceAccount = require("../config/serviceAccountKey.json");

// Function to find a user's FCM token by their user ID
export const findTokenByUserId = async (userId) => {
  try {
    const user = await User.findOne({ _id: userId });
    return user ? user.fcmToken : null;
  } catch (error) {
    console.error("Error finding user:", error);
    return null;
  }
};

const NotificationController = {
  async getAllNotifications(req, res) {
    try {
      const notifications = await Notification.find()
        .populate("Recipient")
        .populate("Creator");
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserNotifications(req, res) {
    try {
      const userId = req.params.userId; // Extracting the userId from the request parameters
      const userNotifications = await Notification.find({ Recipient: userId })
        .populate("Recipient")
        .populate("Creator")
        .sort({ Timestamp: -1 }); // Sorting by newest first

      res.json(userNotifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getNotificationById(req, res) {
    try {
      const notification = await Notification.findById(req.params.id)
        .populate("Recipient")
        .populate("Creator");
      if (!notification) {
        return res.status(404).json({ message: "Cannot find notification" });
      }
      res.json(notification);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createNotification(req, res) {
    const notification = new Notification({
      Content: req.body.Content,
      ReadStatus: req.body.ReadStatus,
      Recipient: req.body.Recipient,
      Type: req.body.Type,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newNotification = await notification.save();
      res.status(201).json(newNotification);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const sendPushNotification = async (userId, notificationData) => {
  try {
    const token = await findTokenByUserId(userId); // Retrieve FCM token for the user
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
    throw error; // Rethrow the error if you want to handle it further up the chain
  }
};

exports.sendPlaydateNotification = async (req, res) => {
  try {
    const { to, title, body, data } = req.body;
    await sendPushNotification(to, { title, body, data });
    res.json({ message: "Notification sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = NotificationController;

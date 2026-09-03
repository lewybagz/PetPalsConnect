const Notification = require("../models/Notification");
const User = require("../models/User");
const Playdate = require("../models/Playdate");
const firebase = require("../config/firebase");
const scheduler = require("../services/scheduler");

const findTokenByUserId = async (userId) => {
  const user = await User.findById(userId).select("fcmToken");
  return user ? user.fcmToken : null;
};

const findPlaydateById = (playdateId) => Playdate.findById(playdateId);

/** Send a push to a single user. No-ops safely when the user has no token. */
const sendPushNotification = async (userId, notificationData) => {
  const token = await findTokenByUserId(userId);
  if (!token) {
    console.warn(`[notifications] No FCM token for user ${userId}; skipping push`);
    return null;
  }

  return firebase.sendMessage({
    token,
    notification: {
      title: notificationData.title,
      body: notificationData.body,
    },
    // FCM requires every data value to be a string.
    data: Object.fromEntries(
      Object.entries(notificationData.data || {}).map(([k, v]) => [k, String(v)])
    ),
  });
};

const sendPlaydateNotification = async (req, res, next) => {
  try {
    const { to, title, body, data } = req.body;
    await sendPushNotification(to, { title, body, data });
    res.json({ message: "Notification sent successfully" });
  } catch (error) {
    next(error);
  }
};

const REVIEW_REMINDER_JOB = "playdate:review-reminder";

// Registered once at module load; the scheduler drains due jobs every minute.
scheduler.registerHandler(REVIEW_REMINDER_JOB, async ({ userId, playdateId }) => {
  await sendPushNotification(userId, {
    title: "Playdate Review",
    body: "How was your playdate? Leave a review!",
    data: { type: "reviewReminder", screen: "PostPlaydateReview", playdateId },
  });
});

/** Queue a "leave a review" nudge for one hour after the playdate starts. */
const pushPlaydateReviewReminderNotification = async (playdateId, userId) => {
  const playdate = await findPlaydateById(playdateId);
  if (!playdate) throw new Error("Playdate not found");

  const runAt = new Date(new Date(playdate.startTime).getTime() + 60 * 60 * 1000);
  if (runAt.getTime() <= Date.now()) return null;

  return scheduler.schedule(REVIEW_REMINDER_JOB, { userId, playdateId }, runAt);
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
    const { userId } = req.params;
    try {
      const userNotifications = await Notification.find({ Recipient: userId })
        .populate("recipient", "name") // Assuming you only need the name
        .populate("creator", "name") // Same here
        .sort({ Timestamp: -1 });

      res.json(userNotifications);
    } catch (err) {
      console.error("Failed to fetch notifications for user:", userId, err);
      res
        .status(500)
        .json({ message: "Failed to fetch notifications", error: err });
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

  async saveDeviceToken(req, res) {
    try {
      const { fcmToken } = req.body;
      const userId = req.userId;

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
  },

  async handleSendNotification(req, res) {
    const { userId, notificationData } = req.body;
    try {
      await sendPushNotification(userId, notificationData);
      res.status(200).json({ message: "Notification sent successfully" });
    } catch (error) {
      console.error("Error in sending notification:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async sendFriendRequestNotification(req, res) {
    try {
      const { userId, requesterId } = req.body;

      const token = await findTokenByUserId(userId);
      if (!token) throw new Error("FCM token not found for user");

      const requester = await User.findById(requesterId).populate("pets", "name");
      if (!requester) throw new Error("Requester not found");
      const requesterName = requester.username;
      const firstPetName = requester.pets[0]?.name || "No pet name";

      const message = {
        token: token,
        notification: {
          title: "New Friend Request",
          body: `${requesterName} has sent you a friend request! Pet: ${firstPetName}`,
        },
        // Optionally, add data field if you want to send additional data along with the notification
        data: {
          type: "friendRequest",
          requesterId: requester._id.toString(),
          petName: firstPetName,
          // Add other data as needed
        },
      };

      await firebase.sendMessage(message);
      res.json({ message: "Friend request notification sent successfully" });
    } catch (error) {
      console.log("Error sending friend request notification:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async fetchRecentNotifications(req, res) {
    try {
      const userId = req.userId;
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
      readStatus: req.body.readStatus || false,
      recipient: req.body.recipient,
      type: req.body.type,
      creator: req.body.creator,
      petName: req.body.petName,
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

module.exports = NotificationController;
module.exports.sendPushNotification = sendPushNotification;
module.exports.sendPlaydateNotification = sendPlaydateNotification;
module.exports.pushPlaydateReviewReminderNotification =
  pushPlaydateReviewReminderNotification;
module.exports.findTokenByUserId = findTokenByUserId;
module.exports.findPlaydateById = findPlaydateById;

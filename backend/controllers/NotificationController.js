const Notification = require("../models/Notification");
const User = require("../models/User");
const Playdate = require("../models/Playdate");
const scheduler = require("../services/scheduler");
const { notify, sendPush } = require("../services/NotificationService");

const findTokenByUserId = async (userId) => {
  const user = await User.findById(userId).select("fcmToken");
  return user ? user.fcmToken : null;
};

const findPlaydateById = (playdateId) => Playdate.findById(playdateId);

/**
 * Send a push to a single user. No-ops safely when the user has no token.
 *
 * The implementation moved to `services/NotificationService` - five other
 * controllers were importing a controller to reach it. This name stays as the
 * way a request handler sends a bare push with no stored row behind it.
 */
const sendPushNotification = (userId, notificationData) =>
  sendPush(userId, notificationData);

const REVIEW_REMINDER_JOB = "playdate:review-reminder";

// Registered once at module load; the scheduler drains due jobs every minute.
//
// This sent a push and stored nothing, so a reminder that arrived while the
// phone was off was gone for good - there was no row for the list to show.
scheduler.registerHandler(REVIEW_REMINDER_JOB, async ({ userId, playdateId }) => {
  await notify({
    content: "How was your playdate? Leave a review.",
    recipientId: userId,
    type: "reviewReminder",
    data: { playdateId },
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
      // Was every notification in the database, recipients populated.
      const notifications = await Notification.find({ recipient: req.userId })
        .sort({ timestamp: -1 })
        .limit(200);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * One user's notifications - which can only be the caller's own.
   *
   * The id came from the URL and was used unchecked, so any signed-in user
   * could read anybody's notifications by putting their id in the path. Being
   * able to name a row is not permission to read it. The sort was `Timestamp`
   * with a capital T, which is not a path either, so the list came back in
   * insertion order however old it was.
   */
  async getUserNotifications(req, res) {
    const { userId } = req.params;

    if (String(userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Not your notifications" });
    }

    try {
      const userNotifications = await Notification.find({ recipient: req.userId })
        .populate("creator", "username")
        .sort({ timestamp: -1 })
        .limit(200);

      res.json(userNotifications);
    } catch (err) {
      console.error("Failed to fetch notifications for user:", userId, err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  },

  /**
   * How many are unread, for the tab badge.
   *
   * A count rather than the list: the badge is on the tab bar, which is mounted
   * for the whole session, and it must not pull 200 documents to draw a dot.
   */
  async getUnreadCount(req, res) {
    try {
      const unread = await Notification.countDocuments({
        recipient: req.userId,
        readStatus: false,
      });
      res.json({ unread });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Marks everything read.
   *
   * `readStatus` has been on the schema from the start with a default of false
   * and nothing has ever set it to true, so the badge - had it worked - could
   * only ever count up.
   */
  async markAllRead(req, res) {
    try {
      const result = await Notification.updateMany(
        { recipient: req.userId, readStatus: false },
        { $set: { readStatus: true, modifiedDate: new Date() } }
      );
      res.json({ updated: result.modifiedCount ?? 0, unread: 0 });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Marks one read, scoped to the caller so an id alone is not enough. */
  async markRead(req, res) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.userId },
        { $set: { readStatus: true, modifiedDate: new Date() } },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ message: "Cannot find notification" });
      }

      res.json(notification);
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
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any notification by guessing or harvesting an id.
      if (String(notification.recipient?._id ?? notification.recipient) !== String(req.userId)) {
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

  /**
   * The last three days.
   *
   * `user` and `createdAt` are not paths on this schema - they are `recipient`
   * and `createdDate` - and `strictQuery` is off, so this asked Mongo for
   * documents with a field that does not exist and got an empty array every
   * time, on a route whose whole purpose is "anything new?".
   */
  async fetchRecentNotifications(req, res) {
    try {
      const threshold = new Date(Date.now() - 72 * 60 * 60 * 1000);

      const notifications = await Notification.find({
        recipient: req.userId,
        timestamp: { $gte: threshold },
      }).sort({ timestamp: -1 });

      res.status(200).json(notifications);
    } catch (error) {
      console.error("Error fetching recent notifications:", error);
      res.status(500).json({ message: "Error fetching notifications" });
    }
  },

};

module.exports = NotificationController;
module.exports.sendPushNotification = sendPushNotification;
module.exports.pushPlaydateReviewReminderNotification =
  pushPlaydateReviewReminderNotification;
module.exports.findTokenByUserId = findTokenByUserId;
module.exports.findPlaydateById = findPlaydateById;

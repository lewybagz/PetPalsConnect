const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");

// GET all Notifications
router.get("/", NotificationController.getAllNotifications);

// GET a single Notification by ID
router.get("/:id", NotificationController.getNotificationById, (req, res) => {
  res.json(res.notification);
});

router.get("/user/:userId", NotificationController.getUserNotifications);

// POST to send a push notification for a playdate
router.post(
  "/send-playdate-notification",
  NotificationController.sendPlaydateNotification
);

// POST a new Notification
router.post("/", NotificationController.createNotification);

module.exports = router;

const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", NotificationController.getAllNotifications);
router.get("/recent", NotificationController.fetchRecentNotifications);
router.get("/unread-count", NotificationController.getUnreadCount);
router.get("/user/:userId", NotificationController.getUserNotifications);

// `POST /` is gone. It wrote `recipient` from the request body, so any signed-in
// account could put a notification with arbitrary text in anybody's list - and
// nothing in the app ever called it. Notifications are a side effect of
// something happening; `services/NotificationService.notify()` is the one way
// to raise one.
router.post("/device-token", NotificationController.saveDeviceToken);
router.post("/read", NotificationController.markAllRead);

// `POST /sendNotification`, `/send-playdate` and the friend-request push were
// "send a push with this title and body to this user id", callable by any
// signed-in account. Nothing in the app used them, and the server raises its
// own pushes at the points that matter, so they were a way to put arbitrary
// text on a stranger's lock screen and nothing else.

router.post("/:id/read", NotificationController.markRead);
router.get("/:id", NotificationController.getNotificationById);

module.exports = router;

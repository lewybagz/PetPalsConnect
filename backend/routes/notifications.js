const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", NotificationController.getAllNotifications);
router.get("/recent", NotificationController.fetchRecentNotifications);
router.get("/user/:userId", NotificationController.getUserNotifications);

router.post("/", NotificationController.createNotification);
router.post("/device-token", NotificationController.saveDeviceToken);
router.post("/sendNotification", NotificationController.handleSendNotification);
router.post("/send-playdate", NotificationController.sendPlaydateNotification);

router.get("/:id", NotificationController.getNotificationById, (req, res) => {
  res.json(res.notification);
});

module.exports = router;

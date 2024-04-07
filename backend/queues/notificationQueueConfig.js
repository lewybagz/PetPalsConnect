// backend/queues/notificationQueueConfig.js
const Queue = require("bull");
const {
  sendPushNotification,
} = require("../controllers/NotificationController"); // Adjust the import path as needed
require("dotenv").config();

const notificationQueue = new Queue("notificationQueue", {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
  },
});

// Process jobs in the notificationQueue
notificationQueue.process(async (job) => {
  const { userId, playdateId } = job.data;
  await sendPushNotification(userId, {
    title: "Playdate Review",
    body: "How was your playdate? Leave a review!",
    data: {
      screen: "PostPlaydateReviewScreen",
      playdateId: playdateId,
    },
  });
});

module.exports = notificationQueue;

// NotificationService.js
import axios from "axios";

export const sendPushNotification = async ({
  recipientUserId,
  title,
  message,
  data,
}) => {
  // Call your server's endpoint to trigger an FCM notification
  try {
    await axios.post("/api/send-notification", {
      to: recipientUserId, // Server will use this to lookup FCM token
      title: title,
      body: message,
      data: data,
    });
    console.log("Notification sent successfully.");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

import axios from "axios";
import { getStoredToken } from "../utils/tokenutil";

export const sendPushNotification = async ({
  recipientUserId,
  title,
  message,
  data,
}) => {
  // First, check if the user has notifications enabled
  const prefResponse = await axios.get(
    `/api/userpreferences/${recipientUserId}`
  );
  if (prefResponse.data.notificationsEnabled) {
    // If notifications are enabled, proceed to send the notification
    await axios.post("/api/send-notification", {
      to: recipientUserId,
      title: title,
      body: message,
      data: data,
    });
    console.log("Notification sent successfully.");
  } else {
    console.log("Notification not sent: User has disabled notifications.");
  }
};

/**
 * Creates a notification in the database.
 * @param {string} content - The content of the notification.
 * @param {string} recipientId - The ID of the recipient user.
 * @param {string} type - The type of notification.
 * @param {string} creatorId - The ID of the creator user.
 */
export const createNotificationInDB = async ({
  content,
  recipientId,
  type,
  creatorId,
}) => {
  const token = await getStoredToken();
  await axios.post(
    `/api/notifications`,
    {
      Content: content,
      Recipient: recipientId,
      Type: type,
      Creator: creatorId,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
};

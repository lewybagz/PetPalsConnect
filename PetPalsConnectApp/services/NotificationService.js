import axios from "axios";
import { getStoredToken } from "../utils/tokenutil";

export const sendPushNotification = async ({
  recipientUserId,
  title,
  message,
  data,
}) => {
  try {
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
  } catch (error) {
    console.error(
      "Error in sending notification or fetching preferences:",
      error
    );
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
  try {
    const token = await getStoredToken();
    const response = await axios.post(
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
    console.log("Notification created in database:", response.data);
  } catch (error) {
    console.error("Error creating notification in database:", error);
  }
};

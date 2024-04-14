// Assuming Notification is a Mongoose model
const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Directly creates a notification in the database.
 * @param {Object} params - The notification parameters.
 * @param {string} params.content - The content of the notification.
 * @param {mongoose.Types.ObjectId} params.recipientId - The ID of the recipient user.
 * @param {string} params.type - The type of notification.
 * @param {mongoose.Types.ObjectId} params.creatorId - The ID of the creator user.
 */
const createNotification = async ({
  content,
  recipientId,
  type,
  creatorId,
}) => {
  try {
    const notification = new Notification({
      Content: content,
      Recipient: recipientId,
      Type: type,
      Creator: creatorId,
    });
    await notification.save();
    console.log("Notification created successfully.");
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw error;
  }
};

/**
 * Fetches all group members excluding the sender.
 * @param {string} groupId - The ID of the group chat.
 * @param {string} senderId - The ID of the user sending the message.
 * @returns {Promise<Array>} - Returns a promise that resolves to an array of group member details.
 */
const fetchGroupParticipants = async (groupId, senderId) => {
  try {
    const groupChat = await groupChat.findById(groupId);
    if (!groupChat) {
      throw new Error("Group not found");
    }
    const participantIds = groupChat.participants.filter(
      (participants) => participants.toString() !== senderId
    );

    const participantsDetails = await User.find({
      _id: { $in: participantIds },
    });
    return participantsDetails;
  } catch (error) {
    console.error("Error fetching group members:", error);
    throw error;
  }
};

module.exports = { createNotification, fetchGroupParticipants };

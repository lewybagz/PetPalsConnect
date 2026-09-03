const Notification = require("../models/Notification");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const { emitToUser } = require("./realtime");

/**
 * Creates a notification and pushes it to the recipient if they are connected.
 *
 * This wrote `Content`, `Recipient`, `Type` and `Creator`. The schema's paths
 * are `content`, `recipient`, `type` and `creator`, and Mongoose runs in strict
 * mode, so all four keys were silently dropped: every notification this app has
 * ever created was an empty document with nothing but a timestamp. Nothing
 * failed loudly - the write "succeeded" - and `getUserNotifications`, which
 * filters by recipient, could never match one. The whole notifications feature
 * was writing blanks and reading nothing.
 *
 * It also returned undefined and never told anyone, so a notification only
 * appeared if the recipient happened to refetch the list.
 *
 * @param {Object} params
 * @param {string} params.content - What the notification says.
 * @param {import("mongoose").Types.ObjectId} params.recipientId - Who it is for.
 * @param {string} params.type - Category, e.g. "DirectMessage".
 * @param {import("mongoose").Types.ObjectId} [params.creatorId] - Who caused it.
 * @param {string} [params.petName] - Optional pet the notification concerns.
 */
const createNotification = async ({
  content,
  recipientId,
  type,
  creatorId,
  petName,
}) => {
  // The schema requires both, and a notification nobody can read is worse than
  // an error - that is exactly how this failed silently before.
  if (!content || !recipientId) {
    throw new Error("createNotification needs both content and recipientId");
  }

  const notification = await Notification.create({
    content,
    recipient: recipientId,
    type,
    creator: creatorId,
    petName,
  });

  // Deliver it now if they are connected; the list endpoint covers the rest.
  emitToUser(recipientId, "notification", notification);

  return notification;
};

/**
 * Every member of a group chat except the sender.
 *
 * This read `await groupChat.findById(...)` into a `const groupChat` declared
 * on that same line, so it threw "Cannot access 'groupChat' before
 * initialization" on every call - the model was never imported either. It is
 * called when a group message is sent, so group notifications always failed.
 */
const fetchGroupParticipants = async (groupId, senderId) => {
  const groupChat = await GroupChat.findById(groupId);
  if (!groupChat) {
    throw new Error("Group not found");
  }

  const participantIds = (groupChat.participants ?? []).filter(
    (participant) => String(participant) !== String(senderId)
  );

  return User.find({ _id: { $in: participantIds } });
};

module.exports = { createNotification, fetchGroupParticipants };

const Notification = require("../models/Notification");
const GroupChat = require("../models/GroupChat");
const User = require("../models/User");
const firebase = require("../config/firebase");
const { emitToUser } = require("./realtime");
const UserPreferences = require("../models/UserPreferences");
const { normalise, titleFor, categoryFor } = require("./notificationTypes");

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
    type: normalise(type),
    creator: creatorId,
    petName,
  });

  // Deliver it now if they are connected; the list endpoint covers the rest.
  emitToUser(recipientId, "notification", notification);

  return notification;
};

/**
 * Sends one push, to whatever device this user last registered.
 *
 * This lived in `NotificationController`, so five *other* controllers imported
 * a controller to get at it - and two of them then called it as
 * `sendPushNotification(notificationData)` with the recipient missing, which
 * casts an object to an ObjectId and throws. Both were inside the `Promise.all`
 * of a create path, so sending a friend request and cancelling a playdate both
 * failed outright on a line whose only job was to be best-effort.
 */
const sendPush = async (userId, { title, body, data } = {}) => {
  if (!userId) return null;

  const user = await User.findById(userId).select("fcmToken");
  if (!user?.fcmToken) {
    // Nobody has opened the app on a device yet, or they declined the prompt.
    // The stored notification is still there when they next look.
    return null;
  }

  return firebase.sendMessage({
    token: user.fcmToken,
    notification: { title, body },
    // FCM requires every data value to be a string.
    data: Object.fromEntries(
      Object.entries(data ?? {})
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)])
    ),
  });
};

/**
 * Whether this person wants a push for this kind of thing.
 *
 * Nothing consulted the preferences, and nothing could: the only read of them
 * passed the whole Express request where a user id goes, so it 404'd on every
 * call, and the screen behind it kept its toggles in component state and never
 * saved. A notification-preferences screen that does not change which
 * notifications arrive is worse than not having one.
 *
 * A missing row means the defaults, which are "yes" - a preference nobody has
 * expressed must not silence them. So must a failed read: it is better to
 * send a push somebody has muted than to drop one they are waiting on.
 */
const wantsPush = async (userId, type) => {
  try {
    const preferences = await UserPreferences.findOne({ user: userId })
      .select("notificationPreferences")
      .lean();
    if (!preferences) return true;

    const settings = preferences.notificationPreferences ?? {};
    if (settings.pushNotificationsEnabled === false) return false;

    const category = categoryFor(type);
    return category ? settings[category] !== false : true;
  } catch (error) {
    console.warn("[notifications] Could not read preferences:", error.message);
    return true;
  }
};

/**
 * Tells somebody something: the stored row, the live socket event, and the push.
 *
 * Every call site did these separately - `Promise.all([createNotification(...),
 * sendPushNotification(...)])` with the wording typed out twice and the two
 * type vocabularies drifting apart. `decide` did not do the push at all, so the
 * only way to learn you had matched was to already be looking at the app.
 *
 * The push is best-effort by construction: a device that has gone away, or a
 * Firebase that is not configured, must never fail the write that caused the
 * notification. The row is the durable part.
 */
const notify = async ({
  content,
  recipientId,
  type,
  creatorId,
  petName,
  title,
  data,
  // Muting a conversation silences the *push*, not the record: the message is
  // still in the list when you next look, which is what people expect from
  // muting rather than blocking.
  push = true,
}) => {
  const canonical = normalise(type);
  const notification = await createNotification({
    content,
    recipientId,
    type: canonical,
    creatorId,
    petName,
  });

  if (!push || !(await wantsPush(recipientId, canonical))) return notification;

  try {
    await sendPush(recipientId, {
      title: title ?? titleFor(canonical),
      body: content,
      data: { ...data, type: canonical, notificationId: String(notification._id) },
    });
  } catch (error) {
    console.warn("[notifications] Push failed:", error.message);
  }

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

module.exports = {
  createNotification,
  sendPush,
  wantsPush,
  notify,
  fetchGroupParticipants,
};

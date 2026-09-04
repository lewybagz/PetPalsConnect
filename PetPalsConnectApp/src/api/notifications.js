import api from "./axios";

/**
 * Notifications, from the app's side.
 *
 * `NotificationsScreen` fetched `/api/notifications/user/${userId}` with a
 * manually attached Authorization header - the shared client already sets one -
 * and rendered each row as a line of text with nothing to tap, because the only
 * field it passed on was `content`. Tapping a *push* worked, sometimes, through
 * a separate table in `usePushNotifications` written against the push payloads
 * and never reconciled with what is stored. So the same event routed one way
 * from a lock screen and nowhere at all from the list.
 *
 * `TYPES` below mirrors `backend/services/notificationTypes.js`, and
 * `backend/test/types.test.js` fails if the two disagree.
 */

/**
 * Type -> where tapping it goes, and the one param that screen reads.
 *
 * Passing a param the destination does not read is not a type error and not a
 * lint error; it renders blank the moment somebody taps.
 */
export const TYPES = {
  message: { screen: "Chat", param: "chatId" },
  groupMessage: { screen: "GroupChat", param: "chatId" },
  messageReaction: { screen: "GroupChat", param: "chatId" },
  friendRequest: { screen: "FriendRequests", param: "requesterId" },
  friendAccepted: { screen: "FriendsList", param: null },
  petMatch: { screen: "PetDetails", param: "petId" },
  playdate: { screen: "PlaydateDetails", param: "playdateId" },
  playdateAccepted: { screen: "PlaydateDetails", param: "playdateId" },
  playdateDeclined: { screen: "PlaydateDetails", param: "playdateId" },
  playdateCancelled: { screen: "MyPlaydates", param: null },
  reviewReminder: { screen: "PostPlaydateReview", param: "playdateId" },
  general: { screen: "Notifications", param: null },
};

/** The values written before the table existed. Rows in the wild still use them. */
const LEGACY = {
  DirectMessage: "message",
  GroupMessage: "groupMessage",
  MessageReaction: "messageReaction",
  FriendRequest: "friendRequest",
  FriendRequestAccepted: "friendAccepted",
  PetMatch: "petMatch",
  Playdate: "playdate",
  "Playdate Accepted": "playdateAccepted",
  "Playdate Declined": "playdateDeclined",
  "Playdate Cancelled": "playdateCancelled",
  PlaydateReminder: "reviewReminder",
};

/** The canonical key for a stored or pushed type. Unknown becomes "general". */
export const normaliseType = (type) => {
  if (TYPES[type]) return type;
  const legacy = LEGACY[type];
  return legacy && TYPES[legacy] ? legacy : "general";
};

/**
 * Where a notification goes when tapped: `[screenName, params]`.
 *
 * Takes the whole notification - stored row or push payload - because the two
 * carry the same fields under the same names now.
 */
export const destinationFor = (notification) => {
  const source = notification?.data ?? notification ?? {};
  const entry = TYPES[normaliseType(notification?.type ?? source.type)];

  const params = {};
  if (entry.param && source[entry.param] != null) {
    params[entry.param] = String(source[entry.param]);
  }

  return [entry.screen, params];
};

/** The caller's notifications, newest first. */
export const fetchNotifications = async () => {
  const { data } = await api.get("/api/notifications");
  return Array.isArray(data) ? data : [];
};

/** How many are unread, for the tab badge. */
export const fetchUnreadCount = async () => {
  const { data } = await api.get("/api/notifications/unread-count");
  return typeof data?.unread === "number" ? data.unread : 0;
};

/** Marks everything read. Returns the new count, which is zero. */
export const markAllRead = async () => {
  const { data } = await api.post("/api/notifications/read");
  return data?.unread ?? 0;
};

/** Marks one read. */
export const markRead = async (notificationId) => {
  const { data } = await api.post(`/api/notifications/${notificationId}/read`);
  return data;
};

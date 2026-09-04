/**
 * What a notification is, and where tapping it goes.
 *
 * `type` was a free String written from five controllers, and every one of them
 * invented its own value: "DirectMessage", "PetMatch", "FriendRequest",
 * "FriendRequestAccepted", "Playdate", "Playdate Cancelled". Separately, the
 * push payloads carried a *different* vocabulary in `data.type` - "message",
 * "friendRequest", "playdate", "reviewReminder" - because the app's
 * `routeForNotification` was written against the pushes and never saw a stored
 * row. So a push could be routed and the identical notification in the list
 * could not: `NotificationItem` rendered a line of text with no destination at
 * all.
 *
 * One table, and the stored `type` *is* the push's `data.type`, so a row and a
 * push describing the same event route to the same screen. The app mirrors this
 * file in `src/api/notifications.js`, and `backend/test/types.test.js` fails if
 * the two disagree.
 *
 * `param` is the route param the destination screen reads. Getting that wrong
 * is not a type error and not a lint error - it renders blank, or throws, the
 * moment somebody taps.
 */

const TYPES = {
  message: {
    title: "New message",
    screen: "Chat",
    param: "chatId",
  },
  groupMessage: {
    title: "New group message",
    screen: "GroupChat",
    param: "chatId",
  },
  messageReaction: {
    title: "Someone reacted",
    screen: "GroupChat",
    param: "chatId",
  },
  friendRequest: {
    title: "New friend request",
    screen: "FriendRequests",
    param: "requesterId",
  },
  friendAccepted: {
    title: "Friend request accepted",
    screen: "FriendsList",
    param: null,
  },
  petMatch: {
    title: "It's a match!",
    screen: "PetDetails",
    param: "petId",
  },
  playdate: {
    title: "Playdate request",
    screen: "PlaydateDetails",
    param: "playdateId",
  },
  playdateAccepted: {
    title: "Playdate confirmed",
    screen: "PlaydateDetails",
    param: "playdateId",
  },
  playdateDeclined: {
    title: "Playdate declined",
    screen: "PlaydateDetails",
    param: "playdateId",
  },
  playdateCancelled: {
    title: "Playdate cancelled",
    screen: "MyPlaydates",
    param: null,
  },
  reviewReminder: {
    title: "How was the playdate?",
    screen: "PostPlaydateReview",
    param: "playdateId",
  },
  general: {
    title: "PetPals Connect",
    screen: "Notifications",
    param: null,
  },
};

/**
 * The values written before this table existed.
 *
 * Rows already in the database keep their old `type`, and dropping them on the
 * floor would empty somebody's notification list on upgrade. Reads normalise;
 * writes only ever use a key of `TYPES`.
 */
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

const isType = (type) => Object.prototype.hasOwnProperty.call(TYPES, type);

/** The canonical key for a stored or incoming type. Unknown becomes "general". */
const normalise = (type) => {
  if (isType(type)) return type;
  const legacy = LEGACY[type];
  return legacy && isType(legacy) ? legacy : "general";
};

/** The push title for a type, when a caller does not supply its own. */
const titleFor = (type) => TYPES[normalise(type)].title;

/** Where tapping it goes: `[screenName, params]`. */
const destinationFor = (type, data = {}) => {
  const entry = TYPES[normalise(type)];
  const params = {};

  if (entry.param && data[entry.param] != null) {
    params[entry.param] = String(data[entry.param]);
  }

  return [entry.screen, params];
};

module.exports = { TYPES, LEGACY, isType, normalise, titleFor, destinationFor };

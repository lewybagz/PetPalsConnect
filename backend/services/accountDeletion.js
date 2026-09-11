const User = require("../models/User");
const Pet = require("../models/Pet");
const HealthRecord = require("../models/HealthRecord");
const Favorite = require("../models/Favorite");
const Friend = require("../models/Friend");
const FriendRequest = require("../models/FriendRequest");
const PetDecision = require("../models/PetDecision");
const PetMatch = require("../models/PetMatch");
const Playdate = require("../models/Playdate");
const Review = require("../models/Review");
const Chat = require("../models/Chat");
const GroupChat = require("../models/GroupChat");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const UserPreferences = require("../models/UserPreferences");
const Subscription = require("../models/Subscription");
const Media = require("../models/Media");
const BlockList = require("../models/BlockList");
const ActivityLog = require("../models/ActivityLog");
const Event = require("../models/Event");
const Waitlist = require("../models/Waitlist");
const firebase = require("../config/firebase");

/**
 * Deletes an account and everything it owns.
 *
 * `DELETE /api/users/me` removed the `User` row and the Firebase login and
 * nothing else - the pets, their photos, every message, playdate, favourite
 * and health record stayed behind under an owner id that no longer resolved.
 * Both stores require that deleting an account deletes the data associated
 * with it (Apple 5.1.1(v), Google Play's User Data policy), and the privacy
 * policy says it does; this is what makes that sentence true.
 *
 * What is deliberately kept, and why, is in `RETAINED` below - the privacy
 * policy's retention section is written from that list. Everything else
 * goes, in an order that leaves a recoverable state if a step fails: the
 * dependants first, the `User` row last, the Firebase account after that
 * (the caller does that, because the app treats "authenticated, no profile"
 * as resumable onboarding rather than a dead login).
 */

/**
 * Rows that survive account deletion, each with the reason the policy gives.
 *
 * - Report: a report *about* the deleted account is what lets moderators see
 *   a pattern across accounts; a report *by* it is evidence the reporter was
 *   real. Both are kept, with the account id as an opaque reference.
 * - SupportMessage: a record of what was said to us, for disputes.
 *
 * ponytail: kept indefinitely. Add a scheduler job that anonymises them after
 * the retention window the policy names (three years) when there is one.
 */
const RETAINED = ["Report", "SupportMessage"];

const deleteAccountData = async (user, firebaseUid) => {
  const userId = user._id;
  const petIds = (await Pet.find({ owner: userId }).select("_id").lean()).map((p) => p._id);
  const petFilter = { $in: petIds };

  // --- Things the account created, in its own name --------------------------
  await HealthRecord.deleteMany({ $or: [{ owner: userId }, { pet: petFilter }] });
  await Favorite.deleteMany({
    $or: [{ user: userId }, { pet: petFilter }, { content: petFilter }],
  });
  await Friend.deleteMany({ $or: [{ user1: userId }, { user2: userId }] });
  await FriendRequest.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] });
  await PetDecision.deleteMany({
    $or: [{ fromUser: userId }, { toUser: userId }, { fromPet: petFilter }, { toPet: petFilter }],
  });
  await PetMatch.deleteMany({
    $or: [{ relevantToUser: userId }, { pet1: petFilter }, { pet2: petFilter }],
  });
  await Review.deleteMany({ reviewer: userId });
  await Notification.deleteMany({ $or: [{ recipient: userId }, { creator: userId }] });
  await UserPreferences.deleteMany({ user: userId });
  // The store keeps the financial record; RevenueCat is the ledger.
  await Subscription.deleteMany({ user: userId });
  await Media.deleteMany({ createdBy: userId });
  await BlockList.deleteMany({ owner: userId });
  await ActivityLog.deleteMany({ user: userId });
  await Waitlist.deleteMany({ user: userId });

  // --- Things shared with other people ---------------------------------------
  // A one-to-one conversation is between two pets, one of which is about to
  // stop existing; the thread goes with it, messages included.
  const chats = await Chat.find({ participants: userId }).select("_id").lean();
  const chatIds = chats.map((c) => c._id);
  await Message.deleteMany({ $or: [{ chat: { $in: chatIds } }, { sender: userId }] });
  await Chat.deleteMany({ _id: { $in: chatIds } });

  // A group survives its members leaving. The account is removed from it and
  // its own messages go; a group it leaves empty goes too.
  await GroupChat.updateMany(
    { participants: userId },
    { $pull: { participants: userId, mutedBy: userId, pets: petFilter } }
  );
  await GroupChat.deleteMany({ participants: { $size: 0 } });

  // A playdate the account organised is cancelled outright; one it was
  // invited to loses that invitation.
  await Playdate.deleteMany({ creator: userId });
  await Playdate.updateMany(
    { participants: userId },
    { $pull: { participants: userId, petsInvolved: petFilter } }
  );

  await Event.deleteMany({ organizer: userId });
  await Event.updateMany({ attendees: userId }, { $pull: { attendees: userId } });

  await User.updateMany({ friendsList: userId }, { $pull: { friendsList: userId } });

  // --- The pets, then the account ---------------------------------------------
  await Pet.deleteMany({ owner: userId });
  await User.deleteOne({ _id: userId });

  // Photos live under the uploader's uid in Storage (`pets/<uid>/…`,
  // `profiles/<uid>/…`, `chat/<uid>/…`). Best-effort: a Storage hiccup must
  // not leave the account half-deleted and the login working, so this is
  // logged rather than thrown.
  try {
    await firebase.deleteUserFiles(firebaseUid);
  } catch (error) {
    console.error("[users] Storage cleanup failed:", error.message);
  }

  return { pets: petIds.length, chats: chatIds.length };
};

module.exports = { deleteAccountData, RETAINED };


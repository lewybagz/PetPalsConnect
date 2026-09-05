const User = require("../models/User");
const PetMatch = require("../models/PetMatch");
const { withDefaults } = require("./settings");

/**
 * Who may reach whom, once their privacy settings are taken into account.
 *
 * This is `services/blocking.js` one layer up. Blocking answers "have these two
 * people refused each other"; this answers "has this person narrowed who may
 * reach them at all". Both have to be consulted by every path that starts a
 * conversation or files a request, and both are here rather than in the
 * controllers for the same reason: a rule about who can see whom, spread across
 * eight controllers, is applied in seven of them.
 *
 * The audiences are ordered - `everyone` ⊃ `matches` ⊃ `friends` - so a stricter
 * setting is always a subset of a looser one, and there is no combination that
 * lets somebody through a narrow setting but not a wide one.
 */

/** Are these two accounts friends? `friendsList` is symmetric on both. */
const areFriends = async (a, b) => {
  if (String(a) === String(b)) return true;
  const user = await User.findById(a).select("friendsList").lean();
  return (user?.friendsList ?? []).some((id) => String(id) === String(b));
};

/**
 * Have their pets matched?
 *
 * A PetMatch is written for both directions on a mutual like, so one row
 * relevant to either of them naming a pet of the other is enough.
 */
const haveMatched = async (a, b) => {
  if (String(a) === String(b)) return true;

  const [petsOfA, petsOfB] = await Promise.all([
    User.findById(a).select("pets").lean(),
    User.findById(b).select("pets").lean(),
  ]);

  const mine = (petsOfA?.pets ?? []).map(String);
  const theirs = (petsOfB?.pets ?? []).map(String);
  if (mine.length === 0 || theirs.length === 0) return false;

  const match = await PetMatch.exists({
    $or: [
      { pet1: { $in: mine }, pet2: { $in: theirs } },
      { pet1: { $in: theirs }, pet2: { $in: mine } },
    ],
  });

  return Boolean(match);
};

/** Do these two share a friend? Only `friendsOfFriends` needs this. */
const shareAFriend = async (a, b) => {
  const [first, second] = await Promise.all([
    User.findById(a).select("friendsList").lean(),
    User.findById(b).select("friendsList").lean(),
  ]);

  const mine = new Set((first?.friendsList ?? []).map(String));
  return (second?.friendsList ?? []).some((id) => mine.has(String(id)));
};

/**
 * Does `viewer` fall inside `audience` for `owner`?
 *
 * `owner` is whoever set the preference; `viewer` is the person trying to
 * reach them. Someone always satisfies their own audience, or a setting would
 * hide a person's own profile from themselves.
 */
const satisfies = async (audience, ownerId, viewerId) => {
  if (String(ownerId) === String(viewerId)) return true;

  switch (audience) {
    case "everyone":
      return true;
    case "matches":
      // Friends count as matches: having become friends is a stronger signal
      // than having matched, and a setting that let a friend through only if
      // their pets had also matched would read as a bug.
      return (await haveMatched(ownerId, viewerId)) || areFriends(ownerId, viewerId);
    case "friends":
      return areFriends(ownerId, viewerId);
    case "friendsOfFriends":
      return (await areFriends(ownerId, viewerId)) || shareAFriend(ownerId, viewerId);
    case "nobody":
      return false;
    default:
      // An unknown audience fails closed. A typo in a setting must not quietly
      // open something up.
      return false;
  }
};

/** Reads one privacy setting off a user document, defaults filled in. */
const privacyOf = (user) => withDefaults(user ?? {}).privacy;

/**
 * May `viewerId` message `ownerId`?
 *
 * Callers must still consult `blocking` - this is the narrower question of
 * whether the recipient has restricted who may start a conversation.
 */
const canMessage = async (ownerId, viewerId) => {
  const owner = await User.findById(ownerId).select("privacy").lean();
  return satisfies(privacyOf(owner).messagesFrom, ownerId, viewerId);
};

/** May `viewerId` send `ownerId` a friend request? */
const canFriendRequest = async (ownerId, viewerId) => {
  const owner = await User.findById(ownerId).select("privacy").lean();
  return satisfies(privacyOf(owner).friendRequestsFrom, ownerId, viewerId);
};

/** May `viewerId` see `ownerId`'s profile? */
const canViewProfile = async (ownerId, viewerId) => {
  const owner = await User.findById(ownerId).select("privacy").lean();
  return satisfies(privacyOf(owner).profileVisibility, ownerId, viewerId);
};

/**
 * Everybody who has opted out of a listing, as an array of id strings.
 *
 * Shaped for `$nin`, the same as `blocking.blockedIdsFor`, so a query can
 * exclude both in one place. `field` is `discoverableInSearch` or `showOnMap`.
 */
const optedOutOf = async (field) =>
  (await User.distinct("_id", { [`privacy.${field}`]: false })).map(String);

module.exports = {
  satisfies,
  canMessage,
  canFriendRequest,
  canViewProfile,
  optedOutOf,
  areFriends,
  haveMatched,
};

const BlockList = require("../models/BlockList");

/**
 * Who cannot see whom.
 *
 * `BlockList` was a model and a controller and nothing else. Not one query in
 * the codebase consulted it: a blocked person stayed in your discovery deck,
 * could still open a chat with you, still turned up in search. The app offered
 * "Block" in two menus, both of which posted PascalCase keys that a lowercase
 * schema silently dropped, so even the row was never written. Blocking has
 * never done anything at all.
 *
 * One document per (owner, blockedUser) pair. The legacy `blockedUserList`
 * array stays on the schema and stays unused - a list that must be read,
 * rewritten and saved to add one entry loses entries whenever two devices
 * block at once, and cannot be indexed.
 */

/**
 * A block is symmetric in effect.
 *
 * If you block someone, you stop seeing them - but they must also stop seeing
 * you, or blocking is only a mute. Someone who blocks a harasser and then
 * appears in that harasser's deck the next morning has been given nothing.
 * Both app stores read "block" as this, and so does every user.
 */
const blockedIdsFor = async (userId) => {
  if (!userId) return [];

  const rows = await BlockList.find({
    $or: [{ owner: userId }, { blockedUser: userId }],
  })
    .select("owner blockedUser")
    .lean();

  const ids = new Set();
  for (const row of rows) {
    if (!row.blockedUser || !row.owner) continue;
    const other =
      String(row.owner) === String(userId) ? row.blockedUser : row.owner;
    ids.add(String(other));
  }

  ids.delete(String(userId));
  return [...ids];
};

/** True when either of the two has blocked the other. */
const isBlockedBetween = async (a, b) => {
  if (!a || !b) return false;

  const existing = await BlockList.exists({
    $or: [
      { owner: a, blockedUser: b },
      { owner: b, blockedUser: a },
    ],
  });

  return Boolean(existing);
};

/**
 * Blocks someone, idempotently.
 *
 * Tapping block twice - or reporting somebody who is already blocked - must
 * not fail, and must not leave two rows behind for one unblock to miss.
 */
const block = async ({ ownerId, blockedUserId }) => {
  if (!ownerId || !blockedUserId) {
    throw new Error("Both an owner and a user to block are required");
  }
  if (String(ownerId) === String(blockedUserId)) {
    throw new Error("You cannot block yourself");
  }

  const now = new Date();
  return BlockList.findOneAndUpdate(
    { owner: ownerId, blockedUser: blockedUserId },
    {
      $setOnInsert: {
        owner: ownerId,
        blockedUser: blockedUserId,
        creator: ownerId,
        createdDate: now,
      },
      $set: { modifiedDate: now },
    },
    { returnDocument: "after", upsert: true }
  );
};

/**
 * Undoes a block the caller made.
 *
 * Scoped to the owner on purpose: without it, `DELETE /api/blocklists/:id`
 * would let the blocked person remove the block placed on them, which is the
 * one thing they must never be able to do.
 */
const unblock = async ({ ownerId, blockedUserId }) => {
  const result = await BlockList.deleteOne({
    owner: ownerId,
    blockedUser: blockedUserId,
  });
  return result.deletedCount > 0;
};

/** The blocks this person made, for the screen that lets them undo one. */
const listBlocked = (ownerId) =>
  BlockList.find({ owner: ownerId, blockedUser: { $exists: true } })
    .populate("blockedUser", "username userPhoto")
    .sort({ createdDate: -1 })
    .lean();

module.exports = {
  blockedIdsFor,
  isBlockedBetween,
  block,
  unblock,
  listBlocked,
};

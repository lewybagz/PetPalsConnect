const Pet = require("../../models/Pet");
const User = require("../../models/User");
const Friend = require("../../models/Friend");
const TrackingShare = require("../../models/TrackingShare");
const blocking = require("../blocking");
const { DEFAULT_HOURS, MAX_HOURS } = require("../../models/TrackingShare");

/**
 * Who may see where a collar is.
 *
 * The rest of the app gives another user the neighbourhood, never the door:
 * `/api/petmatches/map` rounds every stranger's position to about a
 * kilometre and `map.test.js` asserts the exact value never leaves the
 * server. Live tracking is the opposite requirement - an owner looking for a
 * lost dog needs metres - and the two coexist because the question is *who
 * is asking*. This file is the one place that question is answered for a
 * collar, the way `blocking.js` and `audience.js` are for theirs, and every
 * position read goes through `canView`.
 *
 * Exact for the owner. Exact for a friend the owner has explicitly shared
 * this pet with, while the share is live. Nothing for anybody else, and
 * nothing for a friend with a live share the moment either has blocked the
 * other - sharing a live position with somebody you have since blocked is
 * the worst version of this bug, so the block is checked before the share.
 */

const same = (a, b) => String(a) === String(b);

/** The pet's owner id, or null when there is no such pet. */
const ownerOf = async (petId) => {
  const pet = await Pet.findById(petId).select("owner").lean();
  return pet?.owner ?? null;
};

const areFriends = async (a, b) =>
  Boolean(
    await Friend.exists({
      $or: [
        { user1: a, user2: b },
        { user1: b, user2: a },
      ],
    })
  );

/**
 * True when `viewerId` may read `petId`'s live position right now.
 *
 * Fails closed: an unknown pet, a suspended owner, a block in either
 * direction, and a share that has run out all answer false. The caller turns
 * false into a 404, never a 403 - "you may not see this pet" confirms there
 * is something to see.
 */
const canView = async (viewerId, petId) => {
  if (!viewerId || !petId) return false;

  const owner = await ownerOf(petId);
  if (!owner) return false;
  if (same(owner, viewerId)) return true;

  if (await blocking.isBlockedBetween(viewerId, owner)) return false;
  if (await User.exists({ _id: owner, suspended: true })) return false;

  const share = await TrackingShare.exists({
    pet: petId,
    viewer: viewerId,
    expiresAt: { $gt: new Date() },
  });
  return Boolean(share);
};

class ShareError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Hours to a live share window, clamped to a week. */
const hoursToExpiry = (hours, now = new Date()) => {
  const wanted = Number(hours);
  const clamped = Number.isFinite(wanted) && wanted > 0 ? Math.min(wanted, MAX_HOURS) : DEFAULT_HOURS;
  return new Date(now.getTime() + clamped * 60 * 60 * 1000);
};

/**
 * Shares one of the caller's pets with one friend for a while.
 *
 * Only the owner may share, only with a friend, and never across a block.
 * Upserts, so sharing again extends rather than duplicating - the unique
 * index on (pet, viewer) would refuse a second row anyway.
 */
const share = async ({ ownerId, petId, viewerId, hours }) => {
  if (!viewerId || same(ownerId, viewerId)) {
    throw new ShareError(400, "Choose a friend to share with.");
  }
  const owner = await ownerOf(petId);
  if (!owner || !same(owner, ownerId)) throw new ShareError(404, "Not found");

  // "Not available" for a stranger and for a block alike: the wording that
  // tells somebody they are blocked is wording that confirms it.
  if (!(await areFriends(ownerId, viewerId)) || (await blocking.isBlockedBetween(ownerId, viewerId))) {
    throw new ShareError(404, "That person isn't available to share with.");
  }

  const expiresAt = hoursToExpiry(hours);
  return TrackingShare.findOneAndUpdate(
    { pet: petId, viewer: viewerId },
    { $set: { owner: ownerId, expiresAt }, $setOnInsert: { pet: petId, viewer: viewerId, createdDate: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
};

/** Ends a share. Idempotent - ending one that is not there is fine. */
const unshare = async ({ ownerId, petId, viewerId }) => {
  const result = await TrackingShare.deleteOne({ pet: petId, owner: ownerId, viewer: viewerId });
  return result.deletedCount > 0;
};

/** The shares the caller has given, and the live ones they have received. */
const sharesFor = async (userId) => {
  const now = new Date();
  const [given, received] = await Promise.all([
    TrackingShare.find({ owner: userId, expiresAt: { $gt: now } })
      .populate("viewer", "username userPhoto")
      .populate("pet", "name photos")
      .lean(),
    TrackingShare.find({ viewer: userId, expiresAt: { $gt: now } })
      .populate("owner", "username userPhoto")
      .populate("pet", "name photos")
      .lean(),
  ]);

  // A share from somebody who has since blocked or been blocked is not one
  // to list, for the same reason it is not one to honour.
  const blocked = new Set(await blocking.blockedIdsFor(userId));
  return {
    given: given.filter((row) => row.viewer && !blocked.has(String(row.viewer._id))),
    received: received.filter((row) => row.owner && !blocked.has(String(row.owner._id))),
  };
};

module.exports = { canView, share, unshare, sharesFor, hoursToExpiry, ShareError, areFriends };

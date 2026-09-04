const Friend = require("../models/Friend");
const Pet = require("../models/Pet");

/**
 * Friendships.
 *
 * A friendship is a *pair*, so it is stored with the two ids sorted: without
 * that, A-B and B-A are two different rows for the same relationship, and
 * whichever one a query happened to find decided whether you were friends.
 *
 * Nothing ever created one. `updateFriendStatus` - the only writer - looked for
 * `{ sender, receiver }`, which are not paths on this schema (they are `user1`
 * and `user2`), found nothing, logged "Friend relationship not found." and
 * returned; and the app's "Add friend" button posted `senderId`/`recipientId`
 * to `POST /api/friends`, whose keys the schema dropped, failing on the three
 * required fields. So accepting a friend request has never made anybody
 * friends with anybody.
 */

/** The pair, in a fixed order, so one relationship is one row. */
const pairFor = (a, b) =>
  [String(a), String(b)].sort().map((id) => id);

/** Marks two people friends. Idempotent - accepting twice is one friendship. */
const linkFriends = async (a, b) => {
  const [user1, user2] = pairFor(a, b);

  return Friend.findOneAndUpdate(
    { user1, user2 },
    {
      $set: { status: true, modifiedDate: new Date() },
      $setOnInsert: { creator: user1, createdDate: new Date() },
    },
    { upsert: true, new: true }
  );
};

const FriendController = {
  linkFriends,

  async getAllFriends(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours. FriendsListScreen calls this, so it
      // was showing every friendship in the database as if it were yours.
      const friends = await Friend.find({
        status: true,
        $or: [{ user1: req.userId }, { user2: req.userId }],
      })
        // The pets are nested: the list shows each friend with their first
        // pet's name, and an array of bare ids cannot render one.
        .populate({
          path: "user1",
          select: "username userPhoto pets",
          populate: { path: "pets", select: "name breed photos" },
        })
        .populate({
          path: "user2",
          select: "username userPhoto pets",
          populate: { path: "pets", select: "name breed photos" },
        });
      res.json(friends);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFriendById(req, res, next) {
    let friend;
    try {
      // Fetching by id is not authorisation: this returned any friendship in
      // the database, both users populated in full.
      friend = await Friend.findOne({
        _id: req.params.id,
        $or: [{ user1: req.userId }, { user2: req.userId }],
      })
        // The pets are nested: the list shows each friend with their first
        // pet's name, and an array of bare ids cannot render one.
        .populate({
          path: "user1",
          select: "username userPhoto pets",
          populate: { path: "pets", select: "name breed photos" },
        })
        .populate({
          path: "user2",
          select: "username userPhoto pets",
          populate: { path: "pets", select: "name breed photos" },
        });
      if (friend == null) {
        return res
          .status(404)
          .json({ message: "Cannot find friend relationship" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.friend = friend;
    next();
  },

  /**
   * Friendships are made by accepting a friend request, not by asking for one
   * directly.
   *
   * This took `user1` and `user2` from the body, so a client could declare any
   * two accounts friends - including itself and somebody who had never heard
   * of it. Both places in the app that called it were labelled "Add friend"
   * and meant `POST /api/friendrequests`; they say so now. Kept as an explicit
   * refusal rather than a 404 so an older build gets a message it can show.
   */
  async createFriend(req, res) {
    res.status(410).json({
      message:
        "Friendships come from accepting a friend request. " +
        "POST /api/friendrequests instead.",
    });
  },

  /**
   * Unfriends somebody, addressed by them rather than by the row.
   *
   * There was no way to do this at all: the swipe-to-remove action on the
   * friends list was `console.log("Remove friend action")`.
   */
  async removeFriend(req, res) {
    const [user1, user2] = pairFor(req.userId, req.params.userId);

    try {
      const result = await Friend.deleteOne({ user1, user2 });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "You are not friends" });
      }

      res.json({ removed: String(req.params.userId) });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * The pets belonging to the caller's friends.
   *
   * This matched `user1`/`user2` - which hold *user* ids - against a pet id,
   * and filtered on `Status: true`, a field that does not exist. It could only
   * ever return an empty list. `PetSelectionScreen` calls it to pick a pet to
   * arrange a playdate with, so that screen has always been empty.
   */
  async getPetFriends(req, res) {
    try {
      const friendships = await Friend.find({
        status: true,
        $or: [{ user1: req.userId }, { user2: req.userId }],
      }).lean();

      const friendIds = friendships.map((friendship) =>
        String(friendship.user1) === String(req.userId)
          ? friendship.user2
          : friendship.user1
      );

      const pets = await Pet.find({ owner: { $in: friendIds } })
        .populate("owner", "username userPhoto")
        .lean();

      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = FriendController;

const BlockList = require("../models/BlockList");
const blocking = require("../services/blocking");

const BlockListController = {
  async getAllBlockLists(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours. A block list is the one thing that
      // must never be readable by the person it names.
      const blockLists = await blocking.listBlocked(req.userId);
      res.json(blockLists);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getBlockListById(req, res, next) {
    let blockList;
    try {
      blockList = await BlockList.findById(req.params.id)
        .populate("blockedUser", "username userPhoto")
        .populate("blockedUserList", "username userPhoto");
      if (blockList == null) {
        return res.status(404).json({ message: "Cannot find block list" });
      }
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any block list by guessing or harvesting an id.
      if (String(blockList.owner?._id ?? blockList.owner) !== String(req.userId)) {
        return res.status(404).json({ message: "Cannot find block list" });
      }

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.blockList = blockList;
    next();
  },

  /**
   * Blocks someone.
   *
   * The old version wrote PascalCase keys to a lowercase schema, so all five
   * vanished under strict mode and the save then failed on the two required
   * ones. Nothing has ever been blocked. It also took the owner from the body,
   * which would have let a client block on somebody else's behalf.
   */
  async createBlockList(req, res) {
    const blockedUser = req.body.blockedUser ?? req.body.userId;

    if (!blockedUser) {
      return res.status(400).json({ message: "blockedUser is required" });
    }

    try {
      const blockList = await blocking.block({
        ownerId: req.userId,
        blockedUserId: blockedUser,
      });
      res.status(201).json(blockList);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  /**
   * Undoes a block.
   *
   * Addressed by the blocked user's id rather than the row's, because that is
   * what every caller already has - and because scoping the delete to the owner
   * is what stops the blocked person removing the block placed on them.
   */
  async deleteBlockList(req, res) {
    try {
      const removed = await blocking.unblock({
        ownerId: req.userId,
        blockedUserId: req.params.userId,
      });

      if (!removed) {
        return res.status(404).json({ message: "Cannot find block list" });
      }

      res.json({ blockedUser: req.params.userId, blocked: false });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = BlockListController;

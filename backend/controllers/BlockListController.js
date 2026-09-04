const BlockList = require("../models/BlockList");

const BlockListController = {
  async getAllBlockLists(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours. A block list is the one thing that
      // must never be readable by the person it names.
      const blockLists = await BlockList.find({ owner: req.userId }).populate(
        "blockedUser",
        "username userPhoto"
      );
      res.json(blockLists);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getBlockListById(req, res, next) {
    let blockList;
    try {
      blockList = await BlockList.findById(req.params.id)
        .populate("BlockedUser")
        .populate("BlockedUserList")
        .populate("Owner")
        .populate("Creator");
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

  async createBlockList(req, res) {
    // PascalCase against a lowercase schema: all five keys dropped, and the
    // save failed on the two required ones. Blocking has never worked.
    // The owner is the caller - a block list you can create for someone else
    // is worse than one that does not work.
    const blockList = new BlockList({
      blockedUser: req.body.blockedUser,
      blockedUserList: req.body.blockedUserList,
      owner: req.userId,
      creator: req.userId,
      slug: req.body.slug,
    });

    try {
      const newBlockList = await blockList.save();
      res.status(201).json(newBlockList);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = BlockListController;

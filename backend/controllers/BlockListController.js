const BlockList = require("../models/BlockList");

const BlockListController = {
  async getAllBlockLists(req, res) {
    try {
      const blockLists = await BlockList.find()
        .populate("BlockedUser")
        .populate("BlockedUserList")
        .populate("Owner")
        .populate("Creator");
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
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.blockList = blockList;
    next();
  },

  async createBlockList(req, res) {
    const blockList = new BlockList({
      BlockedUser: req.body.BlockedUser,
      BlockedUserList: req.body.BlockedUserList,
      Owner: req.body.Owner,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
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

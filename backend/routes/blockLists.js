const express = require("express");
const router = express.Router();
const BlockListController = require("../controllers/BlockListController");

// GET all BlockLists
router.get("/", BlockListController.getAllBlockLists);

// GET a single BlockList by ID
router.get("/:id", BlockListController.getBlockListById, (req, res) => {
  res.json(res.blockList);
});

// POST a new BlockList
router.post("/", BlockListController.createBlockList);

module.exports = router;

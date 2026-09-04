const express = require("express");
const router = express.Router();
const BlockListController = require("../controllers/BlockListController");

// GET everyone the caller has blocked
router.get("/", BlockListController.getAllBlockLists);

// POST a new block
router.post("/", BlockListController.createBlockList);

// DELETE a block, by the blocked user's id - which is what every caller has.
// Declared before `/:id` so it is not swallowed by it.
router.delete("/user/:userId", BlockListController.deleteBlockList);

// GET a single BlockList by ID
router.get("/:id", BlockListController.getBlockListById, (req, res) => {
  res.json(res.blockList);
});

module.exports = router;

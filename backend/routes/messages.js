const express = require("express");
const router = express.Router();
const MessageController = require("../controllers/MessageController");

// GET all Messages
router.get("/", MessageController.getAllMessages);

// GET a single Message by ID
router.get("/:id", MessageController.getMessageById, (req, res) => {
  res.json(res.message);
});

// POST a new Message
router.post("/", MessageController.createMessage);

module.exports = router;

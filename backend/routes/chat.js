const express = require("express");
const ChatController = require("../controllers/chatController");

const router = express.Router();

// Endpoint to find or create a chat
router.post("/findOrCreate", ChatController.findOrCreateChat);

// Endpoint to add a message to a chat
router.post("/addMessage", ChatController.addMessage);

router.get("/chat/:chatId", ChatController.getChat);

router.delete("/chat/:chatId", ChatController.deleteChat);

module.exports = router;

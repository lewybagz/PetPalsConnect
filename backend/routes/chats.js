const express = require("express");
const ChatController = require("../controllers/ChatController");

const router = express.Router();

// Endpoint to find or create a chat
router.post("/findOrCreate", ChatController.findOrCreateChat);

// Endpoint to add a message to a chat
router.post("/addMessage", ChatController.addMessage);

router.post("/chat/:chatId/archive", ChatController.archiveChat);

router.post("/sendmedia", ChatController.handleSendMedia);

router.get("/chat/:chatId/details", ChatController.getChatDetails);

router.get("/:chatId/media", ChatController.fetchChatMedia);

router.get("/chat/:chatId", ChatController.getChat);

router.delete("/chat/:chatId", ChatController.deleteChat);

module.exports = router;

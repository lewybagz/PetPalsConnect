const express = require("express");
const ChatController = require("../controllers/chatController");

const router = express.Router();

router.get("/", ChatController.getUserChats);
router.post("/findOrCreate", ChatController.findOrCreateChat);
router.post("/addMessage", ChatController.sendMessage);
router.post("/send", ChatController.sendMessage);
router.post("/sendmedia", ChatController.handleSendMedia);

router.get("/:chatId/messages", ChatController.getMessages);
router.post("/:chatId/messages/:messageId/react", ChatController.reactToMessage);
router.delete("/:chatId/messages/:messageId", ChatController.deleteMessage);
router.get("/:chatId/details", ChatController.getChatDetails);
router.get("/:chatId/media", ChatController.fetchChatMedia);
router.post("/:chatId/archive", ChatController.archiveChat);
router.post("/:chatId/pin", ChatController.togglePinChat);
router.post("/:chatId/mute", ChatController.toggleMute);
router.get("/:chatId", ChatController.getChat);
router.delete("/:chatId", ChatController.deleteChat);

module.exports = router;

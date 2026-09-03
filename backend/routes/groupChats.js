const express = require("express");
const router = express.Router();
const GroupChatController = require("../controllers/GroupChatController");

// GET all GroupChats
router.get("/", GroupChatController.getAllGroupChats);

// GET a single GroupChat by ID
router.get("/:id", GroupChatController.getGroupChatById, (req, res) => {
  res.json(res.groupChat);
});

// PUT to update mute settings for a user in a GroupChat

router.get("/:groupId/pets", GroupChatController.getGroupChatPets);

router.get("/:chatId/messages", GroupChatController.getMessages);
router.delete("/:chatId/messages/:messageId", GroupChatController.deleteMessage);
router.get("/:chatId/media", GroupChatController.fetchChatMedia);

router.get("/:chatId/details", GroupChatController.getGroupChatDetails);

router.post("/leave", GroupChatController.leaveGroup);

router.post("/send", GroupChatController.sendMessage);

router.post("/sendmedia", GroupChatController.handleSendMedia);

router.post("/react", GroupChatController.reactToMessage);

router.post("/findOrCreate", GroupChatController.findOrCreateGroupChat);

router.post("/:chatId/archive", GroupChatController.archiveGroupChat);

// POST a new GroupChat
router.post("/", GroupChatController.createGroupChat);

router.put("/toggle-mute", GroupChatController.toggleMute);

router.delete("/:chatId", GroupChatController.deleteGroupChat);

module.exports = router;

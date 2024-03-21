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
router.put("/toggle-mute", GroupChatController.toggleMute);

router.get("/:groupId/pets", GroupChatController.getGroupChatPets);

router.get("/:id", GroupChatController.getGroupChatById);

router.post("/leave", GroupChatController.leaveGroup);

router.post("/sendmedia", GroupChatController.handleSendMedia);

router.get("/chats/:chatId/media", GroupChatController.fetchChatMedia);

router.post("/findOrCreate", GroupChatController.findOrCreateGroupChat);

// POST a new GroupChat
router.post("/", GroupChatController.createGroupChat);

module.exports = router;

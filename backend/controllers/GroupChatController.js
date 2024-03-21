const GroupChat = require("../models/GroupChat");
const Media = require("../models/Media");

const GroupChatController = {
  async getAllGroupChats(req, res) {
    try {
      const groupChats = await GroupChat.find()
        .populate("Messages")
        .populate("Participants")
        .populate("Creator");
      res.json(groupChats);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGroupChatById(req, res, next) {
    let groupChat;
    try {
      groupChat = await GroupChat.findById(req.params.id)
        .populate("Messages")
        .populate("Participants")
        .populate("Creator");
      if (groupChat == null) {
        return res.status(404).json({ message: "Cannot find group chat" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.groupChat = groupChat;
    next();
  },

  // Example method in GroupChatController
  async toggleMute(req, res) {
    const { userId, chatId, mute } = req.body;
    try {
      const chat = await GroupChat.findById(chatId);
      // Logic to toggle mute for the user
      const userSetting = chat.UserSettings.find(
        (setting) => setting.user.toString() === userId
      );
      if (userSetting) {
        userSetting.isMuted = mute;
      } else {
        // If no settings exist for this user, create one
        chat.UserSettings.push({ user: userId, isMuted: mute });
      }
      await chat.save();
      res.status(200).json({ message: "Notification settings updated" });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async handleSendMedia(req, res) {
    const { chatId, mediaUrl, mediaType, userId } = req.body;

    try {
      const newMedia = new Media({
        url: mediaUrl,
        type: mediaType,
        createdBy: userId,
      });
      await newMedia.save();

      const chat = await GroupChat.findById(chatId);
      chat.media.push(newMedia);
      await chat.save();
      res.status(200).json({ message: "Media sent successfully" });
    } catch (error) {
      console.error("Error sending media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async fetchChatMedia(req, res) {
    const chatId = req.params.chatId;
    try {
      const chat = await GroupChat.findById(chatId).populate("media");
      res.json({ media: chat.media });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async leaveGroup(req, res) {
    const { userId, chatId } = req.body;
    try {
      const chat = await GroupChat.findById(chatId);
      chat.Participants.pull(userId); // This removes the user from the participants array
      await chat.save();
      res.status(200).json({ message: "Successfully left the group chat" });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async getGroupChatPets(req, res) {
    try {
      const groupId = req.params.groupId;
      const groupChat = await GroupChat.findById(groupId).populate({
        path: "Participants",
        populate: {
          path: "pets", // Assuming each participant has a 'pets' field
        },
      });

      if (!groupChat) {
        return res.status(404).json({ message: "Group chat not found" });
      }

      // Extract pets from the participants
      const pets = groupChat.Participants.reduce((acc, participant) => {
        if (participant.pets) {
          acc.push(...participant.pets);
        }
        return acc;
      }, []);

      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
  async findOrCreateGroupChat(req, res) {
    try {
      const { GroupName, Participants, Creator } = req.body;

      // Search for an existing group chat with the same participants and name
      let groupChat = await GroupChat.findOne({
        GroupName,
        Participants: { $all: Participants },
      });

      if (!groupChat) {
        // Create a new group chat if it does not exist
        groupChat = new GroupChat({
          GroupName,
          Participants,
          Creator,
        });
        await groupChat.save();
        res.status(201).json(groupChat);
      } else {
        // If group chat exists, return it
        res.status(200).json(groupChat);
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createGroupChat(req, res) {
    const groupChat = new GroupChat({
      GroupName: req.body.GroupName,
      Messages: [], // Initially empty
      Participants: req.body.Participants, // Array of User IDs
      Creator: req.body.Creator,
      Media: req.body.Media || [], // Handle media (optional)
    });

    try {
      const newGroupChat = await groupChat.save();
      res.status(201).json(newGroupChat);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = GroupChatController;

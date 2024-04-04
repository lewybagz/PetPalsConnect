const GroupChat = require("../models/GroupChat");
const Media = require("../models/Media");
const SHA256 = require("crypto-js/sha256");

const GroupChatController = {
  async getAllGroupChats(req, res) {
    try {
      const groupChats = await GroupChat.find()
        .populate("messages")
        .populate("participants")
        .populate("creator");
      res.json(groupChats);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGroupChatDetails(req, res) {
    const { chatId } = req.params;
    try {
      const chat = await GroupChat.findById(chatId)
        .populate("messages") // You may want to populate additional fields in messages
        .populate("participants", "name breed photo ownerId")
        .populate("media"); // Populate this if media contains references to another collection

      if (!chat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async archiveGroupChat(req, res) {
    const groupChatId = req.params.chatId;
    try {
      const updatedGroupChat = await GroupChat.findByIdAndUpdate(
        groupChatId,
        { isArchived: true },
        { new: true }
      );

      if (!updatedGroupChat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }

      res.json(updatedGroupChat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getGroupChatById(req, res, next) {
    let groupChat;
    try {
      groupChat = await GroupChat.findById(req.params.id)
        .populate("messages")
        .populate("participants")
        .populate("creator");
      if (groupChat == null) {
        return res.status(404).json({ message: "Cannot find GroupChat" });
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
        path: "participants",
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
    const { Participants, GroupName, Creator } = req.body;

    // Generate a base ID using the first 3 characters of each userId
    let baseId = Participants.map((id) => id.substring(0, 3)).join("");
    baseId = baseId.length > 50 ? baseId.substring(0, 50) : baseId;
    let chatId = SHA256(baseId).toString();

    try {
      let chat = await chat.findOne({ chatId });

      // Check for existing chat and compare participants
      while (
        chat &&
        !this.isEqualParticipants(chat.participants, Participants)
      ) {
        baseId = this.scrambleId(baseId); // Scramble the baseId
        chatId = SHA256(baseId).toString();
        chat = await chat.findOne({ chatId });
      }

      if (!chat) {
        chat = new chat({
          chatId,
          participants: Participants,
          groupName: GroupName,
          creator: Creator,
          // other chat properties
        });
        await chat.save();
      }

      res.status(200).json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async isEqualParticipants(existingParticipants, newParticipants) {
    // Create sets for easy comparison
    const setExisting = new Set(existingParticipants);
    const setNew = new Set(newParticipants);

    // Check if both sets have the same size
    if (setExisting.size !== setNew.size) return false;

    // Check if every element in one set is present in the other
    for (const id of setExisting) {
      if (!setNew.has(id)) return false;
    }

    return true;
  },

  async scrambleId(id) {
    // Append a random character or string to the ID
    const randomString = Math.random().toString(36).substring(2, 7); // Generate a random string
    return id + randomString;
  },

  async createGroupChat(req, res) {
    const groupChat = new GroupChat({
      groupName: req.body.groupName,
      messages: [], // Initially empty
      participants: req.body.participants, // Array of User IDs
      creator: req.body.creator,
      media: req.body.media || [], // Handle media (optional)
    });

    try {
      const newGroupChat = await groupChat.save();
      res.status(201).json(newGroupChat);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async deleteGroupChat(req, res) {
    const { chatId } = req.params;
    try {
      const groupChat = await GroupChat.findById(chatId);
      if (!groupChat) {
        return res.status(404).json({ message: "Group Chat not found" });
      }

      // Optionally, remove associated messages or other related data
      // ...

      await groupChat.remove();
      res.status(200).json({ message: "Group Chat deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = GroupChatController;

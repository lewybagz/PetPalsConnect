const GroupChat = require("../models/GroupChat");
const Media = require("../models/Media");
const Message = require("../models/Message");
import { sendPushNotification } from "./NotificationController";
import {
  createNotification,
  fetchGroupParticipants,
} from "../services/NotificationService";
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
        .populate("messages")
        .populate("participants", "name breed photo ownerId")
        .populate("media");

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

  async sendMessage(req, res) {
    const { groupId, senderId, messageId } = req.body;
    const senderPetName = req.user.pets[0].name;
    const groupChat = await GroupChat.findById(groupId).populate("name");

    try {
      // Assuming fetchGroupParticipants is correctly implemented and returns an array of member details
      const groupMembers = await fetchGroupParticipants(groupId, senderId);

      const notificationPromises = groupMembers.map((member) => {
        const notificationData = {
          recipientUserId: member.id,
          title: `New Message in ${groupChat.name}`,
          message: `New message in your group chat from ${senderPetName}.`,
          data: {
            groupId,
            messageId,
          },
        };

        // Create two promises for each member: one for sending a push notification, another for creating a database record
        return Promise.all([
          createNotification({
            content: notificationData.message,
            recipientId: member.id,
            type: "GroupMessage",
            creatorId: senderId,
            petName: senderPetName,
          }),
          sendPushNotification(member.id, notificationData),
        ]);
      });

      await Promise.all(notificationPromises.flat());

      res.status(200).json({ message: "Notifications sent successfully." });
    } catch (error) {
      console.error("Error sending notifications:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async reactToMessage(req, res) {
    const { groupId, messageId, reactorId, reaction } = req.body;
    const senderPetName = req.user.pets[0].name;

    try {
      const groupChat = await GroupChat.findById(groupId)
        .populate("participants")
        .populate("name");
      const message = await Message.findById(messageId);

      if (!groupChat || !message) {
        return res
          .status(404)
          .json({ message: "Group chat or message not found" });
      }

      const recipients = groupChat.participants.filter(
        (participant) => participant._id.toString() !== reactorId
      );

      const notificationPromises = recipients.map((member) => {
        const notificationData = {
          recipientUserId: member._id,
          title: `Someone reacted to a message in ${groupChat.name}.`,
          message: `${senderPetName} reacted with ${reaction}.`,
          data: {
            groupId,
            messageId,
            reactorId,
            reaction,
          },
        };

        return Promise.all([
          createNotification({
            content: notificationData.message,
            recipientId: member._id,
            type: "MessageReaction",
            creatorId: reactorId,
            petName: senderPetName,
          }),
          sendPushNotification(member._id, notificationData),
        ]);
      });

      await Promise.all(notificationPromises.flat());

      res
        .status(200)
        .json({ message: "Reaction notifications sent successfully." });
    } catch (error) {
      console.error("Error sending reaction notifications:", error);
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
      const userSetting = chat.UserSettings.find(
        (setting) => setting.user.toString() === userId
      );
      if (userSetting) {
        userSetting.isMuted = mute;
      } else {
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
      chat.participants.pull(userId); // This removes the user from the participants array
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
          path: "pets",
        },
      });

      if (!groupChat) {
        return res.status(404).json({ message: "Group chat not found" });
      }

      // Extract pets from the participants
      const pets = groupChat.participants.reduce((acc, participant) => {
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

    let baseId = Participants.map((id) => id.substring(0, 3)).join("");
    baseId = baseId.length > 50 ? baseId.substring(0, 50) : baseId;
    let chatId = SHA256(baseId).toString();

    try {
      let chat = await chat.findOne({ chatId });

      while (
        chat &&
        !this.isEqualParticipants(chat.participants, Participants)
      ) {
        baseId = this.scrambleId(baseId);
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

    if (setExisting.size !== setNew.size) return false;

    for (const id of setExisting) {
      if (!setNew.has(id)) return false;
    }

    return true;
  },

  async scrambleId(id) {
    // Append a random character or string to the ID
    const randomString = Math.random().toString(36).substring(2, 7);
    return id + randomString;
  },

  async createGroupChat(req, res) {
    const groupChat = new GroupChat({
      groupName: req.body.groupName,
      messages: [],
      participants: req.body.participants,
      creator: req.body.creator,
      media: req.body.media || [],
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

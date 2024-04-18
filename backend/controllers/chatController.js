const Chat = require("../models/Chat");
const Media = require("../models/Media");
const SHA256 = require("crypto-js/sha256");
const {
  createNotification,
  sendPushNotification,
} = require("../services/NotificationService");

const ChatController = {
  async findOrCreateChat(req, res) {
    const { userId, petId } = req.body;
    const chatId = SHA256(`${userId}-${petId}`).toString();

    try {
      let chat = await Chat.findOne({ chatId }).populate("messages");

      if (!chat) {
        chat = new Chat({
          chatId,
          participants: [userId],
          petId,
        });
        await chat.save();
      }

      res.status(200).json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  async sendMessage(req, res) {
    const { chatId, senderId, messageId } = req.body;
    const senderPetName = req.user.pets[0].name;

    try {
      const chat = await Chat.findById(chatId).populate({
        path: "participants",
        match: { _id: { $ne: senderId } },
      });

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const participant = chat.participants[0];

      const notificationData = {
        recipientUserId: participant._id,
        title: "New Message",
        message: `You have a new message from ${senderPetName}.`,
        data: {
          chatId,
          messageId,
        },
      };

      const notificationPromise = createNotification({
        content: notificationData.message,
        recipientId: participant._id,
        type: "DirectMessage",
        creatorId: senderId,
        petName: senderPetName,
      });

      const pushNotificationPromise = sendPushNotification(
        participant._id,
        notificationData
      );

      await Promise.all([notificationPromise, pushNotificationPromise]);

      res.status(200).json({ message: "Notification sent successfully." });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async getChat(req, res) {
    const { chatId } = req.params;
    try {
      const chat = await Chat.findById(chatId).populate("messages");
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.status(200).json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async fetchChatMedia(req, res) {
    const chatId = req.params.chatId;
    try {
      const chat = await Chat.findById(chatId).populate("media");
      res.json({ media: chat.media });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async getChatDetails(req, res) {
    const { chatId } = req.params;
    try {
      const chat = await Chat.findById(chatId)
        .populate("messages")
        .populate("participants");

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
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

      const chat = await Chat.findById(chatId);
      chat.media.push(newMedia);
      await chat.save();
      res.status(200).json({ message: "Media sent successfully" });
    } catch (error) {
      console.error("Error sending media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async archiveChat(req, res) {
    const chatId = req.params.chatId;
    try {
      const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        { isArchived: true },
        { new: true }
      );

      if (!updatedChat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      res.json(updatedChat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteChat(req, res) {
    const { chatId } = req.params;
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Optionally, remove associated messages
      // This depends on your application's data retention policy
      // await Message.deleteMany({ _id: { $in: chat.messages } });

      await chat.remove();
      res.status(200).json({ message: "Chat deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = ChatController;

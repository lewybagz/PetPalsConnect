const Chat = require("../models/Chat");
const Message = require("../models/Message");
const SHA256 = require("crypto-js/sha256"); // Ensure you've installed crypto-js

const ChatController = {
  // Method to create or find an existing chat
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

  // Method to add a message to a chat
  async addMessage(req, res) {
    const { chatId, messageContent } = req.body;
    try {
      const message = new Message({ content: messageContent });
      await message.save();

      const chat = await Chat.findById(chatId);
      chat.messages.push(message);
      chat.lastMessage = message;
      chat.lastUpdated = new Date();
      await chat.save();

      res.status(200).json(message);
    } catch (error) {
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

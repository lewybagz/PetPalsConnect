const Chat = require("../models/Chat");
const Message = require("../models/Message");
const Media = require("../models/Media");
const { createHash } = require("node:crypto");

// Node's built-in crypto replaces the crypto-js dependency.
const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const {
  createNotification,
  sendPushNotification,
} = require("../services/NotificationService");

const ChatController = {
  /** Every chat the caller participates in, most recently active first. */
  async getUserChats(req, res) {
    try {
      const chats = await Chat.find({ participants: req.userId })
        .populate("participants", "username userPhoto")
        .populate("lastMessage")
        .populate("petId", "name photos")
        .sort({ isPinned: -1, updatedAt: -1 });

      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Pins or unpins a chat for the caller. */
  async togglePinChat(req, res) {
    try {
      const chat = await Chat.findOne({
        _id: req.params.chatId,
        participants: req.userId,
      });
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      chat.isPinned = !chat.isPinned;
      await chat.save();
      res.json({ chatId: chat._id, isPinned: chat.isPinned });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async findOrCreateChat(req, res) {
    const { userId, petId } = req.body;
    const chatId = SHA256(`${userId}-${petId}`);

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
  /**
   * Persists a message and notifies the other participant.
   *
   * This previously only sent a notification about a `messageId` the client had
   * written to Firestore. With Firestore gone, the message is stored here.
   */
  async sendMessage(req, res) {
    const { chatId, text, contentText, contentImage } = req.body;
    const body = text ?? contentText;

    if (!body && !contentImage) {
      return res.status(400).json({ message: "A message needs text or an image" });
    }

    try {
      const chat = await Chat.findOne({
        _id: chatId,
        participants: req.userId,
      }).populate("participants", "username pets");

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const recipient = chat.participants.find(
        (p) => String(p._id) !== String(req.userId)
      );

      const message = await Message.create({
        chat: chat._id,
        sender: req.userId,
        creator: req.userId,
        receiver: recipient?._id,
        contentText: body,
        contentImage,
      });

      chat.messages.push(message._id);
      chat.lastMessage = message._id;
      await chat.save();

      // Push the message to anyone watching this conversation right now.
      req.app.get("io")?.to(String(recipient?._id)).emit("message", message);

      if (recipient) {
        const senderName = req.user?.username ?? "Someone";
        await Promise.all([
          createNotification({
            content: `You have a new message from ${senderName}.`,
            recipientId: recipient._id,
            type: "DirectMessage",
            creatorId: req.userId,
          }),
          sendPushNotification(recipient._id, {
            title: "New Message",
            body: `${senderName} sent you a message.`,
            data: { type: "message", chatId: String(chat._id) },
          }),
        ]).catch((error) => console.warn("[chat] notify failed:", error.message));
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  },

  /** Messages in a conversation, oldest first. */
  async getMessages(req, res) {
    try {
      const chat = await Chat.findOne({
        _id: req.params.chatId,
        participants: req.userId,
      });
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const messages = await Message.find({ chat: chat._id, deleted: false })
        .populate("sender", "username userPhoto")
        .sort({ timestamp: 1 });

      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Adds or replaces the caller's reaction on a message. */
  async reactToMessage(req, res) {
    const { reaction } = req.body;

    try {
      const message = await Message.findById(req.params.messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const chat = await Chat.findOne({
        _id: message.chat,
        participants: req.userId,
      });
      if (!chat) {
        return res.status(403).json({ message: "Not a participant in this chat" });
      }

      if (reaction) message.reactions.set(String(req.userId), reaction);
      else message.reactions.delete(String(req.userId));

      await message.save();
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Soft-deletes a message. Only the sender may delete their own. */
  async deleteMessage(req, res) {
    try {
      const message = await Message.findById(req.params.messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (String(message.sender) !== String(req.userId)) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      message.deleted = true;
      await message.save();
      res.json({ messageId: message._id, deleted: true });
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

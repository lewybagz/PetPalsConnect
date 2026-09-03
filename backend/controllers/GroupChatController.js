const GroupChat = require("../models/GroupChat");
const Media = require("../models/Media");
const Message = require("../models/Message");
const { sendPushNotification } = require("./NotificationController");
const {
  createNotification,
  fetchGroupParticipants,
} = require("../services/NotificationService");
const { createHash } = require("node:crypto");

// Node's built-in crypto replaces the crypto-js dependency.
const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");

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

  /**
   * Persists a group message and notifies the other members.
   *
   * As with 1:1 chats, this used to only send notifications about a message the
   * client had written to Firestore. The message is stored here now.
   */
  async sendMessage(req, res) {
    const { groupId, text, contentText, contentImage } = req.body;
    const body = text ?? contentText;

    if (!body && !contentImage) {
      return res.status(400).json({ message: "A message needs text or an image" });
    }

    try {
      const groupChat = await GroupChat.findOne({
        _id: groupId,
        participants: req.userId,
      });
      if (!groupChat) {
        return res.status(404).json({ message: "Group chat not found" });
      }

      const message = await Message.create({
        chat: groupChat._id,
        sender: req.userId,
        creator: req.userId,
        contentText: body,
        contentImage,
      });

      groupChat.messages.push(message._id);
      await groupChat.save();

      const senderName = req.user?.username ?? "Someone";
      const members = await fetchGroupParticipants(groupId, req.userId);

      const io = req.app.get("io");
      await Promise.all(
        members.map((member) => {
          io?.to(String(member.id)).emit("message", message);
          return Promise.all([
            createNotification({
              content: `New message in your group chat from ${senderName}.`,
              recipientId: member.id,
              type: "GroupMessage",
              creatorId: req.userId,
            }),
            sendPushNotification(member.id, {
              title: `New Message in ${groupChat.name}`,
              body: `${senderName} posted in the group.`,
              data: { type: "message", chatId: String(groupChat._id) },
            }),
          ]);
        })
      ).catch((error) => console.warn("[groupchat] notify failed:", error.message));

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending group message:", error);
      res.status(500).json({ message: error.message });
    }
  },

  /** Messages in a group conversation, oldest first. */
  async getMessages(req, res) {
    try {
      const groupChat = await GroupChat.findOne({
        _id: req.params.chatId,
        participants: req.userId,
      });
      if (!groupChat) {
        return res.status(404).json({ message: "Group chat not found" });
      }

      const messages = await Message.find({ chat: groupChat._id, deleted: false })
        .populate("sender", "username userPhoto")
        .sort({ timestamp: 1 });

      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** Soft-deletes a group message. Only the sender may delete their own. */
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
    let chatId = SHA256(baseId);

    try {
      let chat = await chat.findOne({ chatId });

      while (
        chat &&
        !this.isEqualParticipants(chat.participants, Participants)
      ) {
        baseId = this.scrambleId(baseId);
        chatId = SHA256(baseId);
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

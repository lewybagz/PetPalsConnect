const GroupChat = require("../models/GroupChat");
const Media = require("../models/Media");
const Message = require("../models/Message");
const {
  notify,
  fetchGroupParticipants,
} = require("../services/NotificationService");
const { createHash } = require("node:crypto");

// Node's built-in crypto replaces the crypto-js dependency.
const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");

/**
 * The group, if the caller is in it.
 *
 * Naming a group id was enough to read its whole message history, archive it,
 * mute it, post media into it, or remove somebody from it: every one of those
 * handlers looked the chat up by id and stopped there. `authenticate` proves
 * you have an account, not that the conversation is yours.
 */
const memberChat = (chatId, userId) =>
  GroupChat.findOne({ _id: chatId, participants: userId });

const GroupChatController = {
  async getAllGroupChats(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours. This returned every group chat in
      // the database, messages included.
      const groupChats = await GroupChat.find({ participants: req.userId })
        .populate("participants", "username userPhoto")
        .sort({ lastUpdated: -1 });
      res.json(groupChats);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getGroupChatDetails(req, res) {
    const { chatId } = req.params;
    try {
      // The projection asked for pet fields - `name breed photo ownerId` - on
      // documents that are users, so every participant came back with an id
      // and nothing else.
      const chat = await memberChat(chatId, req.userId)
        .populate("messages")
        .populate("participants", "username userPhoto")
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
      const updatedGroupChat = await GroupChat.findOneAndUpdate(
        { _id: groupChatId, participants: req.userId },
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
      const muted = new Set((groupChat.mutedBy ?? []).map(String));

      await Promise.all(
        members.map((member) => {
          io?.to(String(member.id)).emit("message", message);
          // The push said `type: "message"`, which routes to the one-to-one
          // Chat screen; a group message opened the wrong conversation.
          return notify({
            content: `${senderName} posted in ${groupChat.groupName ?? "your group"}.`,
            recipientId: member.id,
            type: "groupMessage",
            creatorId: req.userId,
            data: { chatId: groupChat._id },
            push: !muted.has(String(member.id)),
          });
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
    const { groupId, messageId, reaction } = req.body;
    // Who reacted comes from the token: `reactorId` was read from the body, so
    // anyone could attribute a reaction to anyone.
    const reactorId = req.userId;
    // Adding a pet is optional, so a user may legitimately have none. This read
    // was unguarded and threw for those accounts.
    const senderPetName = req.user?.pets?.[0]?.name ?? req.user?.username ?? "Someone";

    try {
      // `.populate("name")` names a String path, not a reference; `name` is not
      // a path on this schema at all - the group's name is `groupName`.
      const groupChat = await GroupChat.findById(groupId).populate("participants");
      const message = await Message.findById(messageId);

      if (!groupChat || !message) {
        return res
          .status(404)
          .json({ message: "Group chat or message not found" });
      }

      // Naming a group id is not membership in it.
      if (
        !groupChat.participants.some(
          (participant) => String(participant._id) === String(reactorId)
        )
      ) {
        return res.status(403).json({ message: "You are not in this group" });
      }

      const recipients = groupChat.participants.filter(
        (participant) => String(participant._id) !== String(reactorId)
      );

      await Promise.all(
        recipients.map((member) =>
          notify({
            content: `${senderPetName} reacted with ${reaction} in ${
              groupChat.groupName ?? "your group"
            }.`,
            recipientId: member._id,
            type: "messageReaction",
            creatorId: reactorId,
            petName: senderPetName,
            data: { chatId: groupId, messageId },
          })
        )
      );

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
      groupChat = await memberChat(req.params.id, req.userId)
        .populate("messages")
        .populate("participants", "username userPhoto")
        .populate("creator", "username userPhoto");
      if (groupChat == null) {
        return res.status(404).json({ message: "Cannot find GroupChat" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.groupChat = groupChat;
    next();
  },

  /**
   * Mutes or unmutes this group, for the caller only.
   *
   * `chat.UserSettings` is not a path on this schema, so reading `.find` on it
   * threw a TypeError into the catch below and muting a group has always been
   * a 400. `isMuted` was a single boolean on the chat besides, so getting it to
   * work would have muted the group for everybody in it.
   */
  async toggleMute(req, res) {
    const { chatId, mute } = req.body;

    try {
      const chat = await memberChat(chatId, req.userId);
      if (!chat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }

      if (mute === false) chat.mutedBy.pull(req.userId);
      else chat.mutedBy.addToSet(req.userId);

      await chat.save();
      res.status(200).json({ muted: mute !== false });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async handleSendMedia(req, res) {
    const { chatId, mediaUrl, mediaType } = req.body;

    try {
      const chat = await memberChat(chatId, req.userId);
      if (!chat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }

      const newMedia = await Media.create({
        url: mediaUrl,
        type: mediaType,
        // Was `createdBy: userId` straight off the body, so a client could
        // attribute an upload to anybody.
        createdBy: req.userId,
      });

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
      const chat = await memberChat(chatId, req.userId).populate("media");
      if (!chat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }
      res.json({ media: chat.media });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Leaves a group.
   *
   * `userId` came from the body and nothing checked it against the caller, so
   * this was "remove anybody from any group chat" to any signed-in account.
   */
  async leaveGroup(req, res) {
    const { chatId } = req.body;
    try {
      const chat = await memberChat(chatId, req.userId);
      if (!chat) {
        return res.status(404).json({ message: "GroupChat not found" });
      }

      chat.participants.pull(req.userId);
      chat.mutedBy.pull(req.userId);
      await chat.save();
      res.status(200).json({ message: "Successfully left the group chat" });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async getGroupChatPets(req, res) {
    try {
      const groupId = req.params.groupId;
      const groupChat = await memberChat(groupId, req.userId).populate({
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
  /**
   * The group for this exact set of people, created on demand.
   *
   * This could not run. `this.isEqualParticipants` is undefined the moment
   * Express takes the handler by reference; the loop then called `.findOne` on
   * a *document* and `new chat(...)` on one; and both helpers were `async`, so
   * `!this.isEqualParticipants(...)` negated a Promise and was always false
   * anyway. The payload was PascalCase - `Participants`, `GroupName`,
   * `Creator` - against a lowercase schema, and `Creator` was a Firebase uid
   * taken from the body where a Mongo user id was wanted.
   *
   * The key is the sorted participant set, the same idea as a 1:1 chat, so the
   * same group is found whoever asks for it and in whatever order.
   */
  async findOrCreateGroupChat(req, res) {
    const participants = Array.isArray(req.body.participants)
      ? req.body.participants
      : [];
    const groupName = req.body.groupName;

    // The creator is always in their own group. Without this the group did not
    // appear in their list at all - `getAllGroupChats` filters on participants.
    const ids = [...new Set([...participants.map(String), String(req.userId)])];

    if (ids.length < 2) {
      return res
        .status(400)
        .json({ message: "A group needs somebody else in it" });
    }
    if (!groupName) {
      return res.status(400).json({ message: "groupName is required" });
    }

    const chatId = SHA256([...ids].sort().join("-"));

    try {
      let chat = await GroupChat.findOne({ chatId });

      if (!chat) {
        chat = await GroupChat.create({
          chatId,
          groupName,
          participants: ids,
          creator: req.userId,
        });
      }

      res.status(200).json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createGroupChat(req, res) {
    const participants = Array.isArray(req.body.participants)
      ? req.body.participants.map(String)
      : [];

    const groupChat = new GroupChat({
      groupName: req.body.groupName,
      messages: [],
      // The creator was left out of their own group, so it never showed up in
      // their list - `getAllGroupChats` filters on participants.
      participants: [...new Set([...participants, String(req.userId)])],
      // Identity comes from the token, never the body.
      creator: req.userId,
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
      // Only the person who made the group may delete it; everybody else
      // leaves it. This deleted any group by id, from any account.
      const groupChat = await GroupChat.findOne({
        _id: chatId,
        creator: req.userId,
      });
      if (!groupChat) {
        return res.status(404).json({ message: "Group Chat not found" });
      }

      // `.remove()` was removed from Mongoose in v7, so this threw.
      await Message.deleteMany({ _id: { $in: groupChat.messages } });
      await groupChat.deleteOne();
      res.status(200).json({ message: "Group Chat deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = GroupChatController;

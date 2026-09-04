const Chat = require("../models/Chat");
const Message = require("../models/Message");
const Media = require("../models/Media");
const { createHash } = require("node:crypto");

// Node's built-in crypto replaces the crypto-js dependency.
const SHA256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const Pet = require("../models/Pet");
// One call for the stored row, the socket event and the push. `sendPush` used
// to live in NotificationController and the service did not export it, so a
// controller imported a controller to reach it.
const { notify } = require("../services/NotificationService");
const { emitToUser } = require("../services/realtime");
const blocking = require("../services/blocking");

/**
 * The conversation, if the caller is in it.
 *
 * `getChat`, `getChatDetails`, `fetchChatMedia`, `archiveChat` and `deleteChat`
 * all looked a chat up by the id in the URL and stopped there, so any signed-in
 * account could read anybody's private messages, or archive and delete their
 * conversations, given an id. The authorisation audit passed them because it
 * counted `req.params.chatId` as evidence the query was scoped to the caller -
 * which it is not: a resource id is not an identity.
 */
const memberChat = (chatId, userId) =>
  Chat.findOne({ _id: chatId, participants: userId });

const ChatController = {
  /** Every chat the caller participates in, most recently active first. */
  async getUserChats(req, res) {
    try {
      // A blocked person's conversation leaves the inbox. Leaving it there and
      // only refusing new messages means the thread you blocked someone to stop
      // seeing sits at the top of the list with their last message in it.
      const blockedIds = await blocking.blockedIdsFor(req.userId);

      const chats = await Chat.find({
        participants: { $all: [req.userId], $nin: blockedIds },
      })
        .populate("participants", "username userPhoto")
        .populate("lastMessage")
        .populate("petId", "name photos")
        .sort({ isPinned: -1, updatedAt: -1 });

      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Mutes or unmutes this conversation, for the caller only.
   *
   * `ChatOptionsModal` had a "Mute Notifications" item that called the *group*
   * mute endpoint with the one-to-one chat's id, so it silently did nothing.
   * `isMuted` was a single boolean on the chat besides, which would have let
   * one person mute the conversation for the other.
   */
  async toggleMute(req, res) {
    try {
      const chat = await Chat.findOne({
        _id: req.params.chatId,
        participants: req.userId,
      });
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const muted = req.body.mute !== false;
      if (muted) chat.mutedBy.addToSet(req.userId);
      else chat.mutedBy.pull(req.userId);

      await chat.save();
      res.json({ chatId: chat._id, muted });
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

  /**
   * The conversation between the caller and a pet's owner, created on demand.
   *
   * This took `userId` from the request body and created the chat with
   * `participants: [userId]` - one participant, the caller. The owner was never
   * added, so `sendMessage` (which finds "the participant who is not me") never
   * resolved a recipient: no receiver on the message, no notification, no
   * socket delivery. The other person could not see the chat at all, because
   * `getUserChats` filters on participants.
   *
   * The body-supplied `userId` was also the identity bug this codebase has
   * elsewhere - a client could open a chat as somebody else. The caller comes
   * from the token now, and the second participant from the pet's owner.
   *
   * The chat key is derived from the two user ids *sorted*. `${userId}-${petId}`
   * is asymmetric, so A messaging B's pet and B messaging A's pet produced two
   * different threads for the same conversation.
   */
  async findOrCreateChat(req, res) {
    const { petId } = req.body;

    if (!petId) {
      return res.status(400).json({ message: "petId is required" });
    }

    try {
      const pet = await Pet.findById(petId).select("owner name");
      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }
      if (!pet.owner) {
        return res.status(409).json({ message: "That pet has no owner to message" });
      }
      if (String(pet.owner) === String(req.userId)) {
        return res.status(400).json({ message: "You cannot start a chat with yourself" });
      }

      // The same answer in both directions, and deliberately vague: telling
      // somebody "they blocked you" hands a harasser a way to confirm it.
      if (await blocking.isBlockedBetween(req.userId, pet.owner)) {
        return res
          .status(403)
          .json({ message: "This conversation is not available" });
      }

      const pair = [String(req.userId), String(pet.owner)].sort().join("-");
      const chatId = SHA256(pair);

      let chat = await Chat.findOne({ chatId }).populate("messages");

      if (!chat) {
        chat = await Chat.create({
          chatId,
          participants: [req.userId, pet.owner],
          petId,
        });
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

      // Blocking has to hold on a thread that already exists, which is the only
      // kind that matters: nobody blocks a stranger they have never spoken to.
      if (recipient && (await blocking.isBlockedBetween(req.userId, recipient._id))) {
        return res
          .status(403)
          .json({ message: "This conversation is not available" });
      }

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
      emitToUser(recipient?._id, "message", message);

      if (recipient) {
        const senderName = req.user?.username ?? "Someone";
        await notify({
          content: `${senderName} sent you a message.`,
          recipientId: recipient._id,
          type: "message",
          creatorId: req.userId,
          data: { chatId: chat._id },
          // Muting silences the push, not the record.
          push: !(chat.mutedBy ?? []).some(
            (muter) => String(muter) === String(recipient._id)
          ),
        }).catch((error) => console.warn("[chat] notify failed:", error.message));
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
      const chat = await memberChat(chatId, req.userId).populate("messages");
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
      const chat = await memberChat(chatId, req.userId).populate("media");
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json({ media: chat.media });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async getChatDetails(req, res) {
    const { chatId } = req.params;
    try {
      const chat = await memberChat(chatId, req.userId)
        .populate("messages")
        .populate("participants", "username userPhoto");

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async handleSendMedia(req, res) {
    const { chatId, mediaUrl, mediaType } = req.body;

    try {
      // Was `Chat.findById(chatId)` with no participant check and
      // `createdBy: userId` off the body: anyone could push media into any
      // conversation and sign it with somebody else's name.
      const chat = await Chat.findOne({ _id: chatId, participants: req.userId });
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      const newMedia = await Media.create({
        url: mediaUrl,
        type: mediaType,
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

  async archiveChat(req, res) {
    const chatId = req.params.chatId;
    try {
      const updatedChat = await Chat.findOneAndUpdate(
        { _id: chatId, participants: req.userId },
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
      const chat = await memberChat(chatId, req.userId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // `chat.remove()` was removed from Mongoose in v7, so this threw a
      // TypeError on every delete.
      await Message.deleteMany({ _id: { $in: chat.messages } });
      await chat.deleteOne();
      res.status(200).json({ message: "Chat deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = ChatController;

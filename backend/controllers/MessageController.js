const Message = require("../models/Message");

const MessageController = {
  async getAllMessages(req, res) {
    try {
      // This returned every private message in the database, with both
      // parties populated - any account could read every conversation in the
      // app. Messages are read per conversation via
      // `GET /api/chats/:chatId/messages`; this stays only as "mine".
      const messages = await Message.find({
        $or: [{ sender: req.userId }, { receiver: req.userId }],
      })
        .populate("sender", "username userPhoto")
        .populate("receiver", "username userPhoto")
        .sort({ timestamp: -1 })
        .limit(200);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getMessageById(req, res, next) {
    let message;
    try {
      message = await Message.findById(req.params.id)
        .populate("receiver")
        .populate("sender")
        .populate("creator", "name");
      if (message == null) {
        return res.status(404).json({ message: "Cannot find message" });
      }
      // Fetching by id is not authorisation. Without this, any signed-in user
      // could read any message by guessing or harvesting an id.
      if (![message.sender, message.receiver]
        .map((party) => String(party?._id ?? party))
        .includes(String(req.userId))) {
        return res.status(404).json({ message: "Cannot find message" });
      }

    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.message = message;
    next();
  },

  async createMessage(req, res) {
    const message = new Message({
      contentImage: req.body.contentImage,
      contentText: req.body.contentText,
      readStatus: req.body.readStatus,
      receiver: req.body.receiver,
      // Identity comes from the verified token, never the request body.
      sender: req.userId,
      creator: req.userId,
      slug: req.body.slug,
    });

    try {
      const newMessage = await message.save();
      res.status(201).json(newMessage);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = MessageController;

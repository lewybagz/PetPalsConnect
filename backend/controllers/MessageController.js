const Message = require("../models/Message");

const MessageController = {
  async getAllMessages(req, res) {
    try {
      const messages = await Message.find()
        .populate("receiver")
        .populate("sender")
        .populate("creator", "name");
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
      sender: req.body.sender,
      creator: req.body.creator,
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

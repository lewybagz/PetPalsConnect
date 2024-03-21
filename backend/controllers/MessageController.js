const Message = require("../models/Message");

const MessageController = {
  async getAllMessages(req, res) {
    try {
      const messages = await Message.find()
        .populate("Receiver")
        .populate("Sender")
        .populate("Creator");
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getMessageById(req, res, next) {
    let message;
    try {
      message = await Message.findById(req.params.id)
        .populate("Receiver")
        .populate("Sender")
        .populate("Creator");
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
      ContentImage: req.body.ContentImage,
      ContentText: req.body.ContentText,
      ReadStatus: req.body.ReadStatus,
      Receiver: req.body.Receiver,
      Sender: req.body.Sender,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
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

const SupportMessage = require("../models/SupportMessage");
const nodemailer = require("nodemailer");

// Dummy transport configuration. Replace with actual data for your email service
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const sendEmail = async (messageData) => {
  const mailOptions = {
    from: "Contact_@petpalsconnect.com",
    to: messageData.email,
    subject: "Support Request Received",
    text: `Thank you for contacting us, ${messageData.name}. Your message: "${messageData.message}"`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

const SupportMessageController = {
  async getAllSupportMessages(req, res) {
    try {
      const messages = await SupportMessage.find({});
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getSupportMessageById(req, res) {
    try {
      const message = await SupportMessage.findById(req.params.id);
      if (!message)
        return res.status(404).json({ message: "Message not found." });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSupportMessage: async (req, res) => {
    const { name, email, message } = req.body;
    const newMessage = new SupportMessage({ name, email, message });

    try {
      // Save the new support message
      await newMessage.save();
      // Send a confirmation email
      await sendEmail({ name, email, message });
      // Count the documents in the collection
      const count = await SupportMessage.countDocuments();

      // If there are 1000 or more documents, delete the oldest 500
      if (count >= 1000) {
        // Find the oldest 500 documents based on creation date or some other criteria
        const oldestMessages = await SupportMessage.find()
          .sort({ createdAt: 1 })
          .limit(500);

        // Extract their ids
        const idsToDelete = oldestMessages.map((message) => message._id);

        // Delete them from the collection
        await SupportMessage.deleteMany({ _id: { $in: idsToDelete } });
      }
      // Return success response
      res.status(201).json({ message: "Support message sent and saved." });
    } catch (error) {
      // Error handling
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  },

  async updateSupportMessage(req, res) {
    try {
      const updatedMessage = await SupportMessage.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteSupportMessage(req, res) {
    try {
      await SupportMessage.findByIdAndDelete(req.params.id);
      res.json({ message: "Support message deleted successfully." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = SupportMessageController;

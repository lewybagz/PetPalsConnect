const SupportMessage = require("../models/SupportMessage");
const nodemailer = require("nodemailer");

/**
 * Support tickets.
 *
 * A ticket carries somebody's name, their email address and whatever they
 * wrote, which is often the thing they are least happy about. Every read here
 * was by id and unscoped, and so were the update and the delete: any signed-in
 * account could read, rewrite or destroy anybody's ticket.
 *
 * `createSupportMessage` also took the name and the email from the request
 * body and then *sent an email to that address* with the body text quoted back
 * - a mail relay with attacker-controlled recipient and content, reachable by
 * anyone with an account. Both now come from the caller's profile.
 *
 * And it pruned: at 1,000 tickets it deleted the oldest 500, everybody's,
 * silently, inside the create path. A cap is a retention policy, and one that
 * throws away other people's open tickets to make room is not one - it is
 * gone.
 */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/** Email is optional in the same way Stripe is: no credentials, no send. */
const emailEnabled = () =>
  Boolean(process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD);

const sendEmail = async ({ name, email, message }) => {
  if (!emailEnabled()) {
    console.warn("[support] Email not configured; skipping confirmation");
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: "Support Request Received",
      text: `Thank you for contacting us, ${name}. Your message: "${message}"`,
    });
  } catch (error) {
    // A confirmation that could not be sent must never lose the ticket.
    console.error("Error sending email:", error);
  }
};

const SupportMessageController = {
  async getAllSupportMessages(req, res) {
    try {
      // Support tickets carry a name, an email and whatever the person wrote.
      // Unfiltered, any account could read all of them. There is no admin role
      // here, so this is "the tickets I have raised".
      const messages = await SupportMessage.find({ email: req.user?.email })
        .sort({ createdAt: -1 })
        .limit(100);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getSupportMessageById(req, res) {
    try {
      const message = await SupportMessage.findOne({
        _id: req.params.id,
        email: req.user?.email,
      });
      if (!message)
        return res.status(404).json({ message: "Message not found." });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSupportMessage: async (req, res) => {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "A message is required" });
    }

    // Who is asking comes from the verified token, not the body - otherwise
    // the confirmation email goes wherever the caller says.
    const name = req.user?.username ?? "there";
    const email = req.user?.email;

    if (!email) {
      return res.status(400).json({ message: "Your account has no email" });
    }

    try {
      await SupportMessage.create({ name, email, message });
      await sendEmail({ name, email, message });

      res.status(201).json({ message: "Support message sent and saved." });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  },

  /**
   * A ticket is a record of what somebody said at the time.
   *
   * This accepted `req.body` wholesale on any ticket by id, so a support
   * conversation could be rewritten by anybody, including into somebody else's
   * name. Send another one instead.
   */
  async updateSupportMessage(req, res) {
    res.status(410).json({
      message:
        "A support message cannot be edited. Send another one and we will " +
        "read them together.",
    });
  },

  async deleteSupportMessage(req, res) {
    try {
      const deleted = await SupportMessage.findOneAndDelete({
        _id: req.params.id,
        email: req.user?.email,
      });

      if (!deleted) {
        return res.status(404).json({ message: "Message not found." });
      }

      res.json({ message: "Support message deleted successfully." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = SupportMessageController;
module.exports.emailEnabled = emailEnabled;

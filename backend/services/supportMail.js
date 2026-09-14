const nodemailer = require("nodemailer");

/**
 * The confirmation a support ticket sends back, and nothing else.
 *
 * Lifted from `SupportMessageController` so Spot's `contact_support` sends
 * the same mail the Help screen does. Email is optional the way payments
 * are: no credentials, no send, and a confirmation that could not be sent
 * must never lose the ticket.
 */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Never from the test suite: a developer's .env carries real credentials, and
// a two-account test would otherwise mail a real inbox on every run.
const emailEnabled = () =>
  process.env.NODE_ENV !== "test" && Boolean(process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD);

const sendConfirmation = async ({ name, email, message }) => {
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
    console.error("Error sending email:", error);
  }
};

module.exports = { emailEnabled, sendConfirmation };

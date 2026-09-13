const User = require("../models/User");
const SpotConversation = require("../models/SpotConversation");
const client = require("../services/spot/client");
const quota = require("../services/spot/quota");
const runner = require("../services/spot/runner");
const { emitToUser } = require("../services/realtime");

/**
 * Spot, from the API's side.
 *
 * Every conversation is the caller's own (`owner: req.userId` on every read),
 * every message goes through the consent gate and the daily quota before the
 * model is called, and the model is called with tools bound to the caller.
 * A suspended account never reaches here: `/api/spot` is not in
 * `SUSPENDED_ALLOWED`.
 */

/** Five per owner: starting a sixth deletes the oldest. */
const MAX_CONVERSATIONS = 5;
const MAX_TEXT = 2000;
/** Base64 of a compressed phone photo; comfortably inside express.json's 1MB. */
const MAX_IMAGE_CHARS = 900_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const disabled = (res) =>
  res.status(503).json({ message: "Spot isn't available on this server.", code: "SPOT_DISABLED" });

const notFound = (res) => res.status(404).json({ message: "Not found" });

/** A message as the app sees it: never the image bytes, never the tool traffic. */
const publicMessage = (message) => ({
  _id: message._id,
  role: message.role,
  text: message.text,
  blocks: message.blocks ?? [],
  attachments: message.attachments ?? [],
  flagged: Boolean(message.flagged),
  source: message.source ?? "model",
  createdAt: message.createdAt,
});

const publicConversation = (conversation, { withMessages = false } = {}) => ({
  _id: conversation._id,
  title: conversation.title,
  messageCount: conversation.messages?.length ?? 0,
  updatedAt: conversation.updatedAt,
  createdAt: conversation.createdAt,
  ...(withMessages ? { messages: (conversation.messages ?? []).map(publicMessage) } : {}),
});

const ownConversation = (id, userId) => SpotConversation.findOne({ _id: id, owner: userId });

/** The image block from the body, validated, or null; throws a 400 on junk. */
const imageFrom = (body) => {
  const image = body?.image;
  if (!image) return null;
  const { data, mediaType, width, height } = image;
  if (typeof data !== "string" || !data || data.length > MAX_IMAGE_CHARS) {
    throw Object.assign(new Error("That photo is too large to send"), { status: 400, code: "IMAGE_TOO_LARGE" });
  }
  if (!IMAGE_TYPES.includes(mediaType)) {
    throw Object.assign(new Error("That isn't a photo type Spot can read"), { status: 400, code: "IMAGE_TYPE" });
  }
  return {
    data,
    mediaType,
    width: Number.isFinite(Number(width)) ? Number(width) : undefined,
    height: Number.isFinite(Number(height)) ? Number(height) : undefined,
  };
};

const SpotController = {
  /**
   * Whether Spot is on, whether this person has agreed, and where today's
   * quota stands. Always 200, even when Spot is off, so the app can hide the
   * entry points rather than show an error.
   */
  async getStatus(req, res) {
    try {
      const enabled = client.isEnabled();
      const user = await User.findById(req.userId).select("spotConsentAt subscribed spot").lean();
      const day = quota.dayFor(new Date(), req.query.utcOffsetMinutes);
      const limit = quota.limitFor(Boolean(user?.subscribed));
      res.json({
        enabled,
        consented: Boolean(user?.spotConsentAt),
        readChats: Boolean(user?.spot?.readChats),
        quota: enabled
          ? {
              used: await quota.usedToday({ userId: req.userId, day }),
              limit,
              premium: Boolean(user?.subscribed),
            }
          : null,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** The person agreed to the disclosure. Idempotent; the first date is kept. */
  async consent(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const user = await User.findById(req.userId).select("spotConsentAt");
      if (!user) return res.status(404).json({ message: "No profile for this account yet" });
      if (!user.spotConsentAt) {
        user.spotConsentAt = new Date();
        await user.save();
      }
      res.json({ consented: true, since: user.spotConsentAt });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** The caller's conversations, most recent first. */
  async listConversations(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const rows = await SpotConversation.find({ owner: req.userId })
        .select("title messages.role updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean();
      res.json(rows.map((row) => publicConversation(row)));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Starts a conversation. The sixth evicts the oldest - the screen says so
   * before it happens, and `evicted` says whether it did.
   */
  async createConversation(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const existing = await SpotConversation.find({ owner: req.userId })
        .select("_id")
        .sort({ updatedAt: 1 })
        .lean();
      const surplus = existing.length - (MAX_CONVERSATIONS - 1);
      if (surplus > 0) {
        await SpotConversation.deleteMany({
          _id: { $in: existing.slice(0, surplus).map((row) => row._id) },
          owner: req.userId,
        });
      }
      const created = await SpotConversation.create({ owner: req.userId });
      res.status(201).json({ ...publicConversation(created, { withMessages: true }), evicted: surplus > 0 });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getConversation(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const conversation = await ownConversation(req.params.id, req.userId).lean();
      if (!conversation) return notFound(res);
      res.json(publicConversation(conversation, { withMessages: true }));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async deleteConversation(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const deleted = await SpotConversation.findOneAndDelete({ _id: req.params.id, owner: req.userId });
      if (!deleted) return notFound(res);
      res.json({ removed: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * One message in, one answer out.
   *
   * Order matters: consent, then the quota, then the model. A turn the model
   * never completed is refunded. The user's turn is stored before the call
   * and the answer after it, so a failure leaves the question in the
   * transcript with nothing after it, which is the honest state.
   */
  async sendMessage(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const user = await User.findById(req.userId).select("spotConsentAt subscribed spot").lean();
      if (!user) return res.status(404).json({ message: "No profile for this account yet" });
      if (!user.spotConsentAt) {
        return res.status(403).json({
          message: "Agree to how Spot works before asking it anything.",
          code: "SPOT_CONSENT_REQUIRED",
        });
      }

      const conversation = await ownConversation(req.params.id, req.userId);
      if (!conversation) return notFound(res);

      const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, MAX_TEXT) : "";
      const image = imageFrom(req.body);
      if (!text && !image) {
        return res.status(400).json({ message: "Say something first", code: "EMPTY_MESSAGE" });
      }

      const day = quota.dayFor(new Date(), req.body?.utcOffsetMinutes);
      const premium = Boolean(user.subscribed);
      const spent = await quota.spend({ userId: req.userId, day, limit: quota.limitFor(premium) });
      if (!spent.allowed) {
        return res.status(429).json({
          message: premium
            ? "You've used today's Spot messages. They reset tomorrow."
            : "You've used today's free Spot messages. Premium lifts the limit.",
          code: "SPOT_QUOTA",
          used: spent.used,
          limit: spent.limit,
          premium,
        });
      }

      const history = conversation.messages.map((m) => ({ role: m.role, text: m.text }));
      const userMessage = conversation.messages.create({
        role: "user",
        text,
        attachments: image ? [{ kind: "photo", width: image.width, height: image.height }] : [],
        source: "model",
      });
      conversation.messages.push(userMessage);
      if (!conversation.title && text) conversation.title = text.slice(0, 60);
      await conversation.save();

      let answer;
      try {
        answer = await runner.run({
          userId: req.userId,
          history,
          text,
          image,
          readChats: Boolean(user.spot?.readChats),
          onDelta: (delta) =>
            emitToUser(req.userId, "spotDelta", {
              conversationId: String(conversation._id),
              text: delta,
            }),
        });
      } catch (error) {
        await quota.refund({ userId: req.userId, day });
        if (error.status === 503) return disabled(res);
        console.error("[spot] turn failed:", error.message);
        return res.status(502).json({
          message: "Spot couldn't answer just now. Try again in a moment.",
          code: "SPOT_FAILED",
        });
      }

      const reply = conversation.messages.create({
        role: "assistant",
        text: answer.text,
        blocks: answer.blocks,
        source: "model",
      });
      conversation.messages.push(reply);
      await conversation.save();

      res.status(201).json({
        userMessage: publicMessage(userMessage),
        message: publicMessage(reply),
        quota: { used: spent.used, limit: spent.limit, premium },
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
      res.status(500).json({ message: err.message });
    }
  },

  /** "This answer was wrong or harmful." Kept on the row for a moderator to read. */
  async flagMessage(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const conversation = await ownConversation(req.params.id, req.userId);
      if (!conversation) return notFound(res);
      const message = conversation.messages.id(req.params.messageId);
      if (!message || message.role !== "assistant") return notFound(res);
      message.flagged = true;
      message.flagReason =
        typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : undefined;
      await conversation.save();
      res.json({ flagged: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Flagged answers, across accounts, with the question that preceded each.
   * Safe only because its route carries `requireModerator`; `GUARDED_READS`
   * checks that it still does.
   */
  async getFlagged(req, res) {
    try {
      const rows = await SpotConversation.find({ "messages.flagged": true })
        .select("owner messages")
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
      const flagged = [];
      for (const row of rows) {
        row.messages.forEach((message, index) => {
          if (!message.flagged) return;
          const question = row.messages.slice(0, index).reverse().find((m) => m.role === "user");
          flagged.push({
            conversationId: row._id,
            owner: row.owner,
            messageId: message._id,
            reason: message.flagReason ?? null,
            question: question?.text ?? null,
            answer: message.text,
            blocks: message.blocks ?? [],
            at: message.createdAt,
          });
        });
      }
      res.json(flagged);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = SpotController;
module.exports.MAX_CONVERSATIONS = MAX_CONVERSATIONS;

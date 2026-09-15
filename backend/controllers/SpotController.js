const User = require("../models/User");
const SpotConversation = require("../models/SpotConversation");
const client = require("../services/spot/client");
const quota = require("../services/spot/quota");
const runner = require("../services/spot/runner");
const context = require("../services/spot/context");
const noticed = require("../services/spot/noticed");
const route = require("../services/spot/route");
const voice = require("../services/spot/voice");
const reminders = require("../services/spot/reminders");
const { Readable } = require("node:stream");
const { NOTE_LIMIT, NOTE_LENGTH } = context;
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
const USAGE_WINDOW_DAYS = 30;
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
  usage: message.usage ?? null,
  createdAt: message.createdAt,
});

/** The SDK's usage, as the row stores it. */
const usageFor = (usage = {}) => ({
  model: usage.model ?? client.model(),
  input: usage.input_tokens ?? 0,
  output: usage.output_tokens ?? 0,
  cacheRead: usage.cache_read_input_tokens ?? 0,
  cacheWrite: usage.cache_creation_input_tokens ?? 0,
  iterations: usage.iterations ?? 0,
  ms: usage.ms ?? 0,
});

const publicNote = (note) => ({ _id: note._id, text: note.text, createdAt: note.createdAt });

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
        // Whether an AI voice is configured; the phone's own voice needs nothing.
        voice: enabled && voice.isEnabled(),
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
      // Software picks the model; off (always the default) until SPOT_MODEL_LIGHT is set.
      const model = route.modelFor({
        text,
        image: Boolean(image),
        historyModels: conversation.messages.map((m) => m.usage?.model).filter(Boolean),
      });
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
          context: await context.gather(req.userId, { utcOffsetMinutes: req.body?.utcOffsetMinutes }),
          readChats: Boolean(user.spot?.readChats),
          model,
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
        usage: usageFor(answer.usage),
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
   * What Spot would say first, if it spoke first - computed by software on
   * read (`services/spot/noticed.js`), never stored, never a model turn.
   */
  async getNoticed(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      res.json(await noticed.gather(req.userId));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Spot's stored answer, spoken by the configured AI voice, streamed as
   * audio. Only an assistant turn in the caller's own conversation, only its
   * text; nothing is stored. 503 until a provider is configured.
   */
  async getAudio(req, res) {
    if (!client.isEnabled()) return disabled(res);
    if (!voice.isEnabled()) {
      return res.status(503).json({ message: "No voice is configured on this server.", code: "SPOT_VOICE_OFF" });
    }
    try {
      const conversation = await ownConversation(req.params.id, req.userId).lean();
      if (!conversation) return notFound(res);
      const message = (conversation.messages ?? []).find((m) => String(m._id) === String(req.params.messageId));
      if (!message || message.role !== "assistant" || !message.text) return notFound(res);

      const spoken = await voice.speak({ text: message.text });
      if (!spoken.ok || !spoken.body) {
        console.error("[spot] voice failed:", spoken.status);
        return res.status(502).json({ message: "Spot couldn't speak just now.", code: "SPOT_VOICE_FAILED" });
      }
      res.setHeader("Content-Type", spoken.contentType);
      res.setHeader("Cache-Control", "no-store");
      Readable.fromWeb(spoken.body).pipe(res);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      res.status(500).json({ message: err.message });
    }
  },

  /** Reminders Spot has set for this owner, soonest first. */
  async getReminders(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      res.json(await reminders.list(req.userId));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Sets one; also how the app undoes a cancel. */
  async addReminder(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const { text, question, at, repeat, petId, utcOffsetMinutes } = req.body ?? {};
      res.status(201).json(
        await reminders.create({ ownerId: req.userId, text, question, at, repeat: repeat || null, petId, utcOffsetMinutes })
      );
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      res.status(500).json({ message: err.message });
    }
  },

  async deleteReminder(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      await reminders.cancel({ ownerId: req.userId, reminderId: req.params.reminderId });
      res.json({ removed: true });
    } catch (err) {
      if (err.status === 404) return notFound(res);
      res.status(500).json({ message: err.message });
    }
  },

  /** What Spot remembers for this owner, newest last. */
  async getNotes(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const user = await User.findById(req.userId).select("spotNotes").lean();
      res.json((user?.spotNotes ?? []).map(publicNote));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Adds a note in the owner's words; also how the app undoes a "forget". */
  async addNote(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, NOTE_LENGTH) : "";
      if (!text) return res.status(400).json({ message: "Say what to remember", code: "EMPTY_NOTE" });
      const user = await User.findById(req.userId).select("spotNotes");
      if (!user) return res.status(404).json({ message: "No profile for this account yet" });
      if (user.spotNotes.length >= NOTE_LIMIT) {
        return res.status(409).json({ message: `Spot keeps up to ${NOTE_LIMIT} notes. Forget one first.`, code: "NOTES_FULL" });
      }
      user.spotNotes.push({ text });
      await user.save();
      res.status(201).json(publicNote(user.spotNotes[user.spotNotes.length - 1]));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async deleteNote(req, res) {
    if (!client.isEnabled()) return disabled(res);
    try {
      const result = await User.updateOne(
        { _id: req.userId, "spotNotes._id": req.params.noteId },
        { $pull: { spotNotes: { _id: req.params.noteId } } }
      );
      if (result.matchedCount === 0) return notFound(res);
      res.json({ removed: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * What Spot has cost, across accounts, over the last thirty days: turns,
   * tokens, and an estimate in dollars from the price table in `client.js`.
   * Safe only because its route carries `requireModerator`; `GUARDED_READS`
   * checks that it still does.
   */
  async getUsage(req, res) {
    try {
      const since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const rows = await SpotConversation.aggregate([
        { $unwind: "$messages" },
        { $match: { "messages.usage": { $exists: true }, "messages.createdAt": { $gte: since } } },
        {
          $group: {
            _id: "$messages.usage.model",
            turns: { $sum: 1 },
            owners: { $addToSet: "$owner" },
            input: { $sum: "$messages.usage.input" },
            output: { $sum: "$messages.usage.output" },
            cacheRead: { $sum: "$messages.usage.cacheRead" },
            cacheWrite: { $sum: "$messages.usage.cacheWrite" },
            iterations: { $sum: "$messages.usage.iterations" },
            ms: { $sum: "$messages.usage.ms" },
          },
        },
      ]);
      const models = rows.map((row) => {
        const usage = { input: row.input, output: row.output, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite };
        return {
          model: row._id,
          turns: row.turns,
          owners: row.owners.length,
          ...usage,
          iterationsPerTurn: row.turns ? Number((row.iterations / row.turns).toFixed(2)) : 0,
          msPerTurn: row.turns ? Math.round(row.ms / row.turns) : 0,
          estimatedUsd: client.costOf(usage, row._id),
        };
      });
      res.json({
        since,
        days: USAGE_WINDOW_DAYS,
        turns: models.reduce((sum, row) => sum + row.turns, 0),
        estimatedUsd: Number(models.reduce((sum, row) => sum + (row.estimatedUsd ?? 0), 0).toFixed(4)),
        models,
      });
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

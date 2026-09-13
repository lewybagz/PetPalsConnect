const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * One conversation with Spot, and the messages in it.
 *
 * `owner` is on the row because every read is scoped to the caller; there is
 * no other party. Messages are embedded rather than a collection of their own
 * because a conversation is read whole every time it is opened and capped at
 * a size a phone can render - and the whole thing is deleted as one.
 *
 * What is stored is what was said, not how it was worked out: `text` turns
 * only. Tool calls are re-run rather than replayed, which keeps the row small,
 * keeps thinking-block and model-binding rules out of the schema, and means a
 * tool result is always fresh. ponytail: re-running a tool costs a round trip
 * the stored version would not; store tool blocks if that measurably matters.
 *
 * Photos are never stored. `attachments` records that one was sent so the
 * transcript can say "Photo" where it was; the bytes went to the model with
 * the request and nowhere else.
 *
 * `blocks` are the rich pieces the app renders beside the text - `links`,
 * `done`, `contacts` - and vary by type, so they are `Mixed`.
 */
const AttachmentSchema = new Schema(
  {
    kind: { type: String, enum: ["photo"], required: true },
    width: Number,
    height: Number,
  },
  { _id: false }
);

const SpotMessageSchema = new Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  text: { type: String, default: "" },
  blocks: { type: [Schema.Types.Mixed], default: () => [] },
  attachments: { type: [AttachmentSchema], default: () => [] },
  /** Play's AI-content policy wants a way to report an answer; this is it. */
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, maxlength: 500 },
  /** Whether the model was called for this turn, or software answered. */
  source: { type: String, enum: ["model", "software"], default: "model" },
  createdAt: { type: Date, default: Date.now },
});

const SpotConversationSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, maxlength: 80, default: "" },
    messages: { type: [SpotMessageSchema], default: () => [] },
  },
  { timestamps: true }
);

// The list screen: an owner's conversations, most recent first.
SpotConversationSchema.index({ owner: 1, updatedAt: -1 });

const SpotConversation = mongoose.model("SpotConversation", SpotConversationSchema);

module.exports = SpotConversation;

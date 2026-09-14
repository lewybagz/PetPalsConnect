const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const { EVENT_NAMES } = require("../services/analytics/events");

/**
 * One thing that happened, for counting.
 *
 * This exists because nothing in this app measured anything. Every retention
 * number the roadmap was being argued from belonged to somebody else's app in
 * somebody else's category, and there is no credible public data on pet social
 * app retention at all - so the only way to get ours is to record it.
 *
 * Mongo rather than a vendor SDK, for the reason CLAUDE.md already gives twice:
 * MongoDB is the single source of truth for app data, and a funnel we make
 * product decisions from is app data. Firebase Analytics was the close call -
 * `@react-native-firebase/*` is already installed, so it costs no dependency -
 * but taking it would put the one dataset that governs the roadmap in the one
 * place the repo says data must not live.
 *
 * `ActivityLog` was the other candidate and is deleted alongside this being
 * added. It `required` a `User` ref, which cannot record the `needsProfile`
 * step - precisely the step with the highest drop-off - and nothing had ever
 * written it. It was the `Service` / `PotentialPlaydateLocation` shape a third
 * time.
 *
 * ### Why `firebaseUid` and not a `User` ref
 *
 * The most interesting part of the funnel happens before a `User` row exists.
 * Somebody creates a Firebase account, reaches `CreateProfileScreen`, and
 * leaves - that is the zombie-account window `AuthSessionContext` was written
 * to survive, and a schema that can only reference a Mongo profile is blind to
 * exactly it. `userId` is filled in where it is known, so a joined query still
 * works once somebody finishes; it is never required.
 *
 * Nothing else identifying is stored. No IP, no device id, no advertising id.
 */
const AnalyticsEventSchema = new Schema({
  /**
   * Who, as far as this needs to know. Indexed because the funnel counts
   * distinct accounts per step rather than raw events - somebody who opens the
   * app eight times is one person who opened the app.
   */
  firebaseUid: { type: String, required: true, index: true },

  /** Filled in once a profile exists; absent for the pre-profile steps. */
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null },

  /**
   * Validated against the table rather than a duplicated list. An enum written
   * here as well would be a second vocabulary, which is the bug this table
   * exists to prevent.
   */
  name: { type: String, required: true, enum: EVENT_NAMES, index: true },

  /**
   * A little context - which species was chosen, whether the push answer was
   * yes. Deliberately `Mixed` and deliberately small; the controller caps it.
   * Nothing free-text from a user goes in here.
   */
  props: { type: Schema.Types.Mixed, default: {} },

  platform: { type: String, enum: ["ios", "android", "web"], default: null },
  appVersion: { type: String, default: null },

  /**
   * When it happened on the device, not when it arrived. Events are buffered
   * and flushed in batches, so arrival time would smear a ninety-second signup
   * across whenever the network next came back.
   */
  at: { type: Date, default: Date.now, index: true },
});

/** The funnel query: one account's steps, in order. */
AnalyticsEventSchema.index({ firebaseUid: 1, name: 1, at: 1 });

const AnalyticsEvent = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);

module.exports = AnalyticsEvent;

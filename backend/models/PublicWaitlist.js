const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Somebody who asked from the website to be told when the app opens near them.
 *
 * Deliberately not a `User` ref, which is the whole difference from
 * `Waitlist` next door: that one is for an account that installed the app,
 * signed up, and hit the launch fence, and it upserts on `user`. A website
 * visitor has no account, so there is nothing to point at - the email address
 * *is* the identity here, and it is what the row is unique on.
 *
 * `region` is derived from the ZIP through `regionForZip`, never taken from
 * the body, exactly as `WaitlistController.join` derives it from the profile.
 * A list that recorded whatever region the client claimed would say nothing
 * about where demand actually is, which is the only reason this list exists.
 *
 * ponytail: no unsubscribe path. There is no sending mechanism yet, so there
 * is nothing to unsubscribe from; every mail will carry a removal link when
 * one exists. Until then `services/retention.js` is what removes a row.
 */
const PublicWaitlistSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  zip: { type: String },
  region: { type: String, index: true },
  /** Which page the form was on, so the site can tell what converts. */
  source: { type: String, default: "website" },
  createdDate: { type: Date, default: Date.now },
});

const PublicWaitlist = mongoose.model("PublicWaitlist", PublicWaitlistSchema);

module.exports = PublicWaitlist;

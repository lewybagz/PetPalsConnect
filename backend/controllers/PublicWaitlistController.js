const PublicWaitlist = require("../models/PublicWaitlist");
const { isValidZip, regionForZip } = require("../services/regions");

/**
 * The website's waitlist: an email address from somebody with no account.
 *
 * This is the API's only unauthenticated write that a person (rather than a
 * webhook or a device) can reach, so everything it accepts is checked here
 * rather than trusted. `middleware/sanitize` has already stripped `$`-prefixed
 * and dotted keys by the time this runs; what is left is shape.
 *
 * There is deliberately no read path. Nothing can enumerate the list, count
 * it, or ask whether an address is on it - an endpoint answering "is this
 * email waiting?" is an account-existence oracle for anybody with a wordlist.
 */

/** Deliberately loose: the real proof an address exists is mail arriving at it. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PublicWaitlistController = {
  /** Joins, or re-joins - submitting twice is the same row, not an error. */
  async join(req, res) {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const zip = String(req.body?.zip ?? "").trim();

      if (!EMAIL.test(email) || email.length > 254) {
        return res.status(400).json({
          message: "That doesn't look like an email address.",
          code: "INVALID_EMAIL",
        });
      }

      // The ZIP is what tells the list *where* demand is, so it is required
      // here even though the in-app path can inherit one from a profile.
      if (!isValidZip(zip)) {
        return res.status(400).json({
          message: "That doesn't look like a US ZIP code.",
          code: "INVALID_ZIP",
        });
      }

      // Derived, never read from the body - a client-supplied region would
      // make the one signal this list carries meaningless.
      const region = regionForZip(zip);
      const source = String(req.body?.source ?? "website").trim().slice(0, 40);

      await PublicWaitlist.findOneAndUpdate(
        { email },
        {
          $set: { zip, region },
          $setOnInsert: { email, source, createdDate: new Date() },
        },
        { upsert: true }
      );

      // The same answer whether the row was new or already there: "you are on
      // it" is all the sender needs, and distinguishing the two would tell an
      // unauthenticated caller whether an address had signed up before.
      res.status(201).json({ joined: true });
    } catch (err) {
      // A racing duplicate insert lands on the unique index rather than the
      // upsert's find. It is the same outcome the caller asked for.
      if (err?.code === 11000) return res.status(201).json({ joined: true });
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = PublicWaitlistController;

const Waitlist = require("../models/Waitlist");
const User = require("../models/User");

/**
 * The launch waitlist.
 *
 * The fence itself is a session state in the app, not a refusal here: a
 * waitlisted account is not turned away from anything server-side. This is
 * only the "tell me when" button, and the row it writes is what says where
 * the next launch should be.
 */
const WaitlistController = {
  /** Joins, or re-joins - safe to tap twice. Where you are comes from the profile. */
  async join(req, res) {
    try {
      const user = await User.findById(req.userId).select("zip region").lean();
      if (!user) {
        return res.status(404).json({ message: "No profile for this account yet" });
      }

      const entry = await Waitlist.findOneAndUpdate(
        { user: req.userId },
        {
          $set: { zip: user.zip, region: user.region },
          $setOnInsert: { user: req.userId, creator: req.userId, createdDate: new Date() },
        },
        { upsert: true, returnDocument: "after" }
      ).lean();

      res.status(201).json({ joined: true, since: entry.createdDate });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Whether the caller is on it, so the button can say so after a reinstall. */
  async me(req, res) {
    try {
      const entry = await Waitlist.findOne({ user: req.userId }).lean();
      res.json({ joined: Boolean(entry), since: entry?.createdDate ?? null });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = WaitlistController;

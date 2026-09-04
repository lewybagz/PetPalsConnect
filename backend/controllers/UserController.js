const User = require("../models/User");
const { toCoordinates, rangeToMiles } = require("../services/matching/distance");
const firebase = require("../config/firebase");
const usernames = require("../services/usernames");
const { scrypt, randomBytes, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(scrypt);

// Replaces bcrypt with Node's built-in scrypt - one less native dependency to
// compile, and no separate package to keep patched.
const hashSecret = async (value) => {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(value, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
};

const verifySecret = async (value, stored) => {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(value, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};

const UserController = {
  /**
   * Finds people by username.
   *
   * Was `User.find()` with no filter and no projection: one request returned
   * every account in the database, email addresses and Firebase uids included.
   * Nothing in the app called it. It is a search now, and it returns only what
   * one user may see of another.
   */
  async getAllUsers(req, res) {
    const query = String(req.query.q ?? "").trim();

    try {
      if (query.length < 2) {
        return res.json([]);
      }

      const users = await User.find({
        usernameLower: { $regex: `^${query.toLowerCase().replace(/[^a-z0-9_.-]/g, "")}` },
        _id: { $ne: req.userId },
      })
        .select("username userPhoto verified")
        .limit(20);

      res.json(users);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * One user's profile.
   *
   * This returned the whole document to anyone who asked - email address,
   * Firebase uid, FCM device token, security questions, Stripe customer id -
   * and pet records hand out their owner's id freely, so the browsable half of
   * the app led straight to everybody's personal data.
   *
   * You get the full record for yourself and the public projection for anyone
   * else. (`populate("friends")` was a no-op too: the path is `friendsList`.)
   */
  async getUserById(req, res, next) {
    const PUBLIC_FIELDS = "username userPhoto verified pets createdDate";
    const isSelf = String(req.params.id) === String(req.userId);

    try {
      const query = User.findById(req.params.id).populate(
        "pets",
        "name age breed photos"
      );
      if (!isSelf) query.select(PUBLIC_FIELDS);

      const user = await query;

      if (!user) {
        return res.status(404).json({ message: "Cannot find user" });
      }
      res.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },

  async getUserPets(req, res) {
    const userId = req.userId;
    try {
      const user = await User.findById(userId).populate("pets");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user.pets);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Records where the caller is, so discovery can filter by distance.
   *
   * Nothing stored a user's position before: `location` on the schema is a
   * reference to a *place* they saved, so matching had no idea whether two
   * pets were a mile or a continent apart, and `playdateRange` enforced
   * nothing at all.
   *
   * Sharing is opt-out. Someone who has turned location sharing off is not
   * quietly tracked anyway - the position is cleared instead, and they simply
   * see everyone.
   */
  async updateMyLocation(req, res) {
    const coordinates = toCoordinates(req.body);

    if (!coordinates) {
      return res
        .status(400)
        .json({ message: "latitude and longitude are required, as numbers" });
    }

    try {
      const user = await User.findById(req.userId).select("locationSharingEnabled");
      if (!user) {
        return res.status(404).json({ message: "No profile for this account yet" });
      }

      if (user.locationSharingEnabled === false) {
        await User.updateOne(
          { _id: req.userId },
          { $unset: { geoLocation: "", locationUpdatedAt: "" } }
        );
        return res.json({ stored: false, reason: "location sharing is off" });
      }

      await User.updateOne(
        { _id: req.userId },
        {
          geoLocation: { type: "Point", coordinates },
          locationUpdatedAt: new Date(),
        }
      );

      res.json({ stored: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** The signed-in caller's own profile. Resolved from the verified token. */
  async getCurrentUser(req, res) {
    if (!req.user) {
      return res.status(404).json({
        message: "No profile exists for this account yet",
        code: "PROFILE_NOT_FOUND",
      });
    }

    const user = await User.findById(req.user._id)
      .populate("friendsList", "username userPhoto")
      .populate("pets", "name age breed photos");

    res.json(user);
  },

  /**
   * Creates the Mongo profile for a freshly registered Firebase account.
   *
   * Identity comes from the verified token, never from the request body - a
   * client must not be able to claim another account's uid or email. The old
   * implementation called `new user(...)` (lowercase, the local variable rather
   * than the model), which threw on every call, and never set firebaseUid,
   * which the schema requires.
   */
  /** Reports whether a username is free, and why not when it isn't. */
  async checkUsernameAvailability(req, res) {
    const candidate = req.query.username;

    const problem = usernames.validate(candidate);
    if (problem) {
      return res.json({ available: false, reason: problem });
    }

    const taken = await User.exists({ usernameLower: usernames.normalise(candidate) });
    res.json({
      available: !taken,
      reason: taken ? "That username is already taken." : null,
    });
  },

  /**
   * Creates the Mongo profile for a freshly registered Firebase account.
   *
   * Identity comes from the verified token, never from the request body - a
   * client must not be able to claim another account's uid or email. The old
   * implementation called `new user(...)` (lowercase, the local variable rather
   * than the model), which threw on every call, and never set firebaseUid,
   * which the schema requires.
   *
   * Safe to call repeatedly: signup is two non-atomic steps (Firebase account,
   * then this), so the app retries this one whenever it finds an authenticated
   * user with no profile. Retrying returns the existing profile rather than
   * failing on the unique index.
   */
  async createUser(req, res) {
    const { uid, email } = req.firebaseUser;

    try {
      const existing = await User.findOne({ firebaseUid: uid });
      if (existing) {
        return res.status(200).json(existing);
      }

      const problem = usernames.validate(req.body.username);
      if (problem) {
        return res.status(400).json({ message: problem, field: "username" });
      }

      const user = new User({
        firebaseUid: uid,
        email: email ?? req.body.email,
        username: String(req.body.username).trim(),
        userPhoto: req.body.userPhoto,
        location: req.body.location,
        pets: [],
        friendsList: [],
        subscribed: false,
        verified: req.firebaseUser.email_verified ?? false,
        slug: req.body.slug,
      });

      const newUser = await user.save();
      res.status(201).json(newUser);
    } catch (err) {
      // Two clients can pass the availability check at the same moment; the
      // unique index is what actually decides, so translate its error.
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern ?? {})[0];
        if (field === "firebaseUid") {
          const existing = await User.findOne({ firebaseUid: uid });
          if (existing) return res.status(200).json(existing);
        }
        return res.status(409).json({
          message:
            field === "email"
              ? "An account already exists for that email address."
              : "That username was just taken. Please pick another.",
          field: field === "email" ? "email" : "username",
        });
      }
      res.status(400).json({ message: err.message });
    }
  },

  /**
   * Permanently deletes the caller's account: Mongo profile first, then the
   * Firebase credential.
   *
   * Apple's App Store guideline 5.1.1(v) requires apps that offer account
   * creation to offer in-app deletion, so this is a shipping requirement rather
   * than a nicety. Deleting the profile first means a failure part-way leaves a
   * recoverable state - the app treats "authenticated, no profile" as resumable
   * onboarding - rather than a login with no way back in.
   */
  async deleteCurrentUser(req, res) {
    if (!req.user) {
      return res.status(404).json({ message: "No profile to delete" });
    }

    try {
      await User.deleteOne({ _id: req.user._id });

      try {
        await firebase.deleteUser(req.firebaseUser.uid);
      } catch (error) {
        // The profile is already gone, so the account is unusable either way.
        // Report success and log for follow-up rather than stranding the user.
        console.error("[users] Firebase deletion failed:", error.message);
      }

      res.json({ message: "Account deleted" });
    } catch (error) {
      console.error("[users] Account deletion failed:", error.message);
      res.status(500).json({ message: "Could not delete the account" });
    }
  },

  /** Merges the app's notification toggles onto the caller's profile. */
  async updateNotificationPreferences(req, res) {
    try {
      const updated = await User.findByIdAndUpdate(
        req.userId,
        { $set: { notificationPreferences: req.body } },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "Notification preferences updated", user: updated });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /** The caller's favourited pets. */
  async getUserFavorites(req, res) {
    // Identity comes from the token. The id in the path is accepted for the
    // existing call sites, but reading somebody else's favourites is not.
    if (req.params.userId && String(req.params.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only read your own favourites" });
    }

    try {
      const user = await User.findById(req.params.userId ?? req.userId).populate({
        path: "favorites",
        populate: { path: "pet" },
      });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user.favorites ?? []);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateUser(req, res) {
    if (req.body.Username != null) {
      res.user.Username = req.body.Username;
    }
    if (req.body.email != null) {
      res.user.email = req.body.email;
    }
    if (req.body.location != null) {
      res.user.location = req.body.location;
    }
    if (req.body.userPhoto != null) {
      res.user.userPhoto = req.body.userPhoto;
    }
    if (req.body.subscribed != null) {
      res.user.subscribed = req.body.subscribed;
    }
    if (req.body.verified != null) {
      res.user.verified = req.body.verified;
    }
    if (req.body.slug != null) {
      res.user.slug = req.body.slug;
    }
    if (req.body.friendsList != null) {
      res.user.friendsList = req.body.friendsList;
    }
    if (req.body.pets != null) {
      res.user.pets = req.body.pets;
    }

    try {
      const updatedUser = await res.user.save();
      res.json(updatedUser);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async deleteUserPet(req, res) {
    const { petId } = req.params;
    const userId = req.userId;
    try {
      // Find user and update their pets list
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Filter out the pet to delete
      user.pets = user.pets.filter((pet) => pet._id.toString() !== petId);

      await user.save();
      res.json({ message: "Pet deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateUserLocationSharing(req, res) {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.userId,
        { locationSharingEnabled: req.body.locationSharingEnabled },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "location sharing preference updated", user });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateTwoFactorAuthentication(req, res) {
    const { userId, enable2FA } = req.body;
    try {
      // Assuming there is a field in your User model for 2FA settings
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { twoFactorAuthEnabled: enable2FA },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        message: `Two-factor authentication has been ${
          enable2FA ? "enabled" : "disabled"
        }`,
        twoFactorAuthEnabled: updatedUser.twoFactorAuthEnabled,
      });
    } catch (error) {
      console.error("Error updating 2FA setting:", error);
      res.status(500).json({ message: "Failed to update 2FA setting" });
    }
  },

  /**
   * Password changes are handled entirely by Firebase Auth on the client via
   * `updatePassword()`. This server never stores passwords, so there is nothing
   * for it to change. Kept as an explicit response so older clients get a clear
   * message instead of a confusing 404.
   */
  async changeUserPassword(req, res) {
    res.status(410).json({
      message:
        "Password changes are handled by Firebase Auth on the client. " +
        "Call updatePassword() from the app instead.",
    });
  },

  async updateSecurityQuestion(req, res) {
    const { userId, question, answer } = req.body;

    try {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the answer
      const hashedAnswer = await hashSecret(answer);

      // Update or add security question
      const securityQuestion = { question, answer: hashedAnswer };
      user.securityQuestions = [securityQuestion];
      await user.save();

      res.json({ message: "Security question updated successfully" });
    } catch (error) {
      console.error("Error updating security question:", error);
      res.status(500).json({ message: "Failed to update security question" });
    }
  },

  async updateUserSettings(req, res) {
    const userId = req.userId;
    const { playdateRange, notificationsEnabled, locationSharingEnabled } =
      req.body;

    try {
      // Assuming these are the names of the fields in your User model
      // `playdateRange` is a number of miles now. An older client (or a value
      // cached on the device) may still send "Within 20 miles"; convert rather
      // than fail validation, which is what the enum did to every save the
      // settings slider ever made.
      const rangeMiles =
        typeof playdateRange === "string"
          ? (rangeToMiles(playdateRange) ?? 0)
          : playdateRange;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          playdateRange: rangeMiles,
          notificationsEnabled,
          locationSharingEnabled,
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Settings updated successfully", user: updatedUser });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  },

  async deleteUser(req, res) {
    try {
      await res.user.deleteOne();
      res.json({ message: "Deleted User" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = UserController;
// Exported for the security-question check, which has no route yet.
module.exports.verifySecret = verifySecret;

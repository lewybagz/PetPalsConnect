const User = require("../models/User");
const bcrypt = require("bcrypt");

const UserController = {
  async getAllUsers(req, res) {
    try {
      const users = await User.find();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserById(req, res, next) {
    let user;
    try {
      user = await User.findById(req.params.id);
      if (user == null) {
        return res.status(404).json({ message: "Cannot find user" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.user = user;
    next();
  },

  async getUserpets(req, res) {
    const userId = req.params.userId; // Get user ID from URL parameter

    try {
      const user = await User.findById(userId).populate("pets"); // Use the userId from URL parameter

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user.pets);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createUser(req, res) {
    const user = new user({
      friendsList: req.body.friendsList,
      location: req.body.location,
      pets: req.body.pets,
      subscribed: req.body.subscribed,
      username: req.body.username,
      userPhoto: req.body.userPhoto,
      verified: req.body.verified,
      email: req.body.email,
      slug: req.body.slug,
    });

    try {
      const newUser = await user.save();
      res.status(201).json(newUser);
    } catch (err) {
      res.status(400).json({ message: err.message });
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
    const userId = req.params.userId;

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

  async changeUserPassword(req, res) {
    const { userId, currentPassword, newPassword } = req.body;

    try {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect current password" });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  },

  async updateSecurityQuestion(req, res) {
    const { userId, question, answer } = req.body;

    try {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the answer
      const hashedAnswer = await bcrypt.hash(answer, 10);

      // Update or add security question
      const securityQuestion = { question, answer: hashedAnswer };
      user.securityQuestions = [securityQuestion]; // Replace or add to existing questions
      await user.save();

      res.json({ message: "Security question updated successfully" });
    } catch (error) {
      console.error("Error updating security question:", error);
      res.status(500).json({ message: "Failed to update security question" });
    }
  },

  async updateUserSettings(req, res) {
    const { userId } = req.user; // Obtain user ID from authentication middleware
    const { playdateRange, notificationsEnabled, locationSharingEnabled } =
      req.body;

    try {
      // Assuming these are the names of the fields in your User model
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          playdateRange,
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
      await res.user.remove();
      res.json({ message: "Deleted User" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = UserController;

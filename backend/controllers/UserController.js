const User = require("../models/User");

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

  async getUserPets(req, res) {
    const userId = req.params.userId; // Get user ID from URL parameter

    try {
      const user = await User.findById(userId).populate("Pets"); // Use the userId from URL parameter

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user.Pets);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createUser(req, res) {
    const user = new User({
      FriendsList: req.body.FriendsList,
      Location: req.body.Location,
      Pets: req.body.Pets,
      Subscribed: req.body.Subscribed,
      Username: req.body.Username,
      UserPhoto: req.body.UserPhoto,
      Verified: req.body.Verified,
      Email: req.body.Email,
      Slug: req.body.Slug,
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
    if (req.body.Email != null) {
      res.user.Email = req.body.Email;
    }
    if (req.body.Location != null) {
      res.user.Location = req.body.Location;
    }
    if (req.body.UserPhoto != null) {
      res.user.UserPhoto = req.body.UserPhoto;
    }
    if (req.body.Subscribed != null) {
      res.user.Subscribed = req.body.Subscribed;
    }
    if (req.body.Verified != null) {
      res.user.Verified = req.body.Verified;
    }
    if (req.body.Slug != null) {
      res.user.Slug = req.body.Slug;
    }
    if (req.body.FriendsList != null) {
      res.user.FriendsList = req.body.FriendsList;
    }
    if (req.body.Pets != null) {
      res.user.Pets = req.body.Pets;
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
      user.Pets = user.Pets.filter((pet) => pet._id.toString() !== petId);

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

      res.json({ message: "Location sharing preference updated", user });
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

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

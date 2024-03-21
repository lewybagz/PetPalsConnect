const Friend = require("../models/Friend");

const FriendController = {
  async getAllFriends(req, res) {
    try {
      const friends = await Friend.find()
        .populate("User1")
        .populate("User2")
        .populate("Creator");
      res.json(friends);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFriendById(req, res, next) {
    let friend;
    try {
      friend = await Friend.findById(req.params.id)
        .populate("User1")
        .populate("User2")
        .populate("Creator");
      if (friend == null) {
        return res
          .status(404)
          .json({ message: "Cannot find friend relationship" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.friend = friend;
    next();
  },

  async createFriend(req, res) {
    const friend = new Friend({
      Status: req.body.Status,
      User1: req.body.User1,
      User2: req.body.User2,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newFriend = await friend.save();
      res.status(201).json(newFriend);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  async getPetFriends(req, res) {
    try {
      const petId = req.params.petId;
      const friendRelations = await Friend.find({
        $or: [{ User1: petId }, { User2: petId }],
        Status: true, // Ensure they are confirmed friends
      })
        .populate("User1")
        .populate("User2");

      const petFriends = friendRelations.reduce((pets, relation) => {
        if (relation.User1._id.toString() === petId) {
          pets.push(relation.User2); // Add User2 if User1 is the specified pet
        } else {
          pets.push(relation.User1); // Add User1 if User2 is the specified pet
        }
        return pets;
      }, []);

      res.json(petFriends);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = FriendController;

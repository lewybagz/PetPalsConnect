const Friend = require("../models/Friend");

const FriendController = {
  async getAllFriends(req, res) {
    try {
      const friends = await Friend.find()
        .populate("user1")
        .populate("user2")
        .populate("creator");
      res.json(friends);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFriendById(req, res, next) {
    let friend;
    try {
      friend = await Friend.findById(req.params.id)
        .populate("user1")
        .populate("user2")
        .populate("creator");
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
      Status: req.body.status,
      User1: req.body.user1,
      User2: req.body.user2,
      Creator: req.body.creator,
      Slug: req.body.slug,
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
        $or: [{ user1: petId }, { user2: petId }],
        Status: true,
      })
        .populate("user1")
        .populate("user2");

      const petFriends = friendRelations.reduce((pets, relation) => {
        if (relation.user1._id.toString() === petId) {
          pets.push(relation.user2);
        } else {
          pets.push(relation.user1);
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

const Favorite = require("../models/Favorite");

const FavoriteController = {
  async getAllFavorites(req, res) {
    try {
      const favorites = await Favorite.find()
        .populate("content")
        .populate("user")
        .populate("creator");
      res.json(favorites);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getFavoriteById(req, res, next) {
    let favorite;
    try {
      favorite = await Favorite.findById(req.params.id)
        .populate("content")
        .populate("user")
        .populate("creator");
      if (favorite == null) {
        return res.status(404).json({ message: "Cannot find favorite" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.favorite = favorite;
    next();
  },

  async createFavorite(req, res) {
    const favorite = new Favorite({
      content: req.body.content,
      user: req.body.user,
      creator: req.body.creator,
      slug: req.body.slug,
    });

    try {
      const newFavorite = await favorite.save();
      res.status(201).json(newFavorite);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = FavoriteController;

const Favorite = require("../models/Favorite");
const Pet = require("../models/Pet");
const User = require("../models/User");

const FavoriteController = {
  /**
   * The caller's favourites.
   *
   * This returned `Favorite.find()` with no filter and every user document
   * populated - one request handed back the whole table, and everybody's email
   * with it.
   */
  async getAllFavorites(req, res) {
    try {
      const favorites = await Favorite.find({ user: req.userId })
        .populate("pet")
        .sort({ createdDate: -1 });
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

  /**
   * Saves a pet to the caller's favourites.
   *
   * This never set `pet`, which the schema requires, so every save failed
   * validation with a 400 - favouriting has never worked. It also took `user`
   * and `creator` from the request body, so a client could favourite on
   * somebody else's behalf, and it never pushed the new favourite onto
   * `user.favorites`, which is the array `getUserFavorites` reads. Even a
   * successful write would have been invisible.
   *
   * `Pet` is a discriminator of `Content`, so one pet id satisfies both refs.
   */
  async createFavorite(req, res) {
    const petId = req.body.petId ?? req.body.content;
    if (!petId) {
      return res.status(400).json({ message: "petId is required" });
    }

    try {
      const pet = await Pet.findById(petId).select("_id");
      if (!pet) {
        return res.status(404).json({ message: "Cannot find that pet" });
      }

      // Favouriting twice is a double tap, not an error.
      const favorite = await Favorite.findOneAndUpdate(
        { user: req.userId, pet: pet._id },
        {
          $set: { content: pet._id, creator: req.userId, modifiedDate: new Date() },
          $setOnInsert: { createdDate: new Date() },
        },
        { upsert: true, new: true }
      );

      await User.updateOne(
        { _id: req.userId },
        { $addToSet: { favorites: favorite._id } }
      );

      res.status(201).json(favorite);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  /** Removes a pet from the caller's favourites. */
  async removeFavorite(req, res) {
    try {
      const favorite = await Favorite.findOneAndDelete({
        user: req.userId,
        pet: req.params.petId,
      });

      if (favorite) {
        await User.updateOne(
          { _id: req.userId },
          { $pull: { favorites: favorite._id } }
        );
      }

      // Idempotent: unfavouriting something that is not favourited is fine.
      res.json({ removed: Boolean(favorite) });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
};

module.exports = FavoriteController;

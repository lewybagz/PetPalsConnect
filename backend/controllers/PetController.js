const Pet = require("../models/Pet");
const User = require("../models/User");
const pets = require("../services/pets");
const Favorite = require("../models/Favorite"); // or Pet model, as needed
const { matchableQuery } = require("../services/matching/eligibility");

const PetController = {
  /**
   * The browsable field of pets.
   *
   * Dogs only, and that is a privacy decision rather than a matching one. A
   * profile can now hold a cat or a rabbit, but those are added to get food,
   * supplies and a vet out of the care hub - not published for strangers to
   * browse. A dog is on this app to meet other dogs; nothing else here is.
   */
  async getAllPets(req, res) {
    try {
      const pets = await Pet.find(matchableQuery());
      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getPetById(req, res) {
    try {
      // The route declares "/:petId"; this read "req.params.id", so the lookup
      // was always undefined.
      const pet = await Pet.findById(req.params.petId);
      if (pet == null) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      res.json(pet);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Updates one of the caller's own pets.
   *
   * Read "req.params.id" against a "/:petId" route, and only ever applied
   * `name` however much the client sent - the rest of the form was silently
   * discarded.
   */
  async updatePet(req, res) {
    try {
      const { pet } = await pets.update({ ownerId: req.userId, petId: req.params.petId, fields: req.body });
      res.json(pet);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  },

  async getPetOwnerById(req, res) {
    try {
      const pet = await Pet.findById(req.params.id);
      if (!pet) {
        return res.status(404).json({ message: "Cannot find pet" });
      }

      // Assuming the pet model has an 'owner' field that stores the owner's ID
      res.json({ ownerId: pet.owner });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** The home screen's new-pets shelf. Dogs only, as `getAllPets` explains. */
  async getLatestPets(req, res) {
    try {
      const latestPets = await Pet.find(matchableQuery())
        .sort({ createdAt: -1 })
        .limit(10);
      res.json(latestPets);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getUserFavorites(req, res) {
    try {
      const userId = req.userId;
      const userFavorites = await Favorite.find({ user: userId }) // or relevant logic
        .populate("pet");
      res.json(userFavorites);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** Deletes one of the caller's own pets and unlinks it from their profile. */
  async deletePet(req, res) {
    try {
      const pet = await Pet.findById(req.params.petId);
      if (!pet) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      // Without this check any signed-in user could delete anyone's pet.
      if (String(pet.owner) !== String(req.userId)) {
        return res.status(403).json({ message: "That isn't your pet" });
      }

      await pet.deleteOne();
      await User.updateOne({ _id: req.userId }, { $pull: { pets: pet._id } });

      res.json({ message: "Deleted Pet", petId: pet._id });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /**
   * Creates a pet for the signed-in user and links it to their profile.
   *
   * Ownership comes from the verified token, never the request body - the
   * previous version took `owner` from the client, so anyone could create a pet
   * belonging to somebody else. It also never pushed the pet onto `user.pets`,
   * which left every pet orphaned and made "does this user have a pet?"
   * permanently false.
   */
  async createPet(req, res) {
    if (!req.userId) {
      return res.status(404).json({ message: "No profile for this account yet" });
    }
    try {
      // Ownership, the link onto `user.pets`, photo sanitising and the
      // best-effort matching run all live in `services/pets.js`, which Spot's
      // add_pet tool calls as well.
      const { pet, matches } = await pets.create({ ownerId: req.userId, fields: req.body });
      res.status(201).json({ pet, matches });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      console.error("[pets] Create failed:", error.message);
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = PetController;

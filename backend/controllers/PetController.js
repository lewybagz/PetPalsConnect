const Pet = require("../models/Pet");
const User = require("../models/User");
const SubscriptionController = require("./SubscriptionController");
const PetMatchController = require("./PetMatchController");
const Favorite = require("../models/Favorite"); // or Pet model, as needed

const PetController = {
  async getAllPets(req, res) {
    try {
      const pets = await Pet.find();
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
    const EDITABLE = [
      "name",
      "breed",
      "age",
      "weight",
      "photos",
      "specialNeeds",
      "temperament",
      "activityLevel",
      "socialisation",
      "favoriteActivities",
      "location",
    ];

    try {
      const pet = await Pet.findById(req.params.petId);
      if (!pet) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      if (String(pet.owner) !== String(req.userId)) {
        return res.status(403).json({ message: "That isn't your pet" });
      }

      for (const field of EDITABLE) {
        if (req.body[field] !== undefined) pet[field] = req.body[field];
      }
      pet.modifiedDate = new Date();

      const updatedPet = await pet.save();
      res.json(updatedPet);
    } catch (err) {
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

  async getLatestPets(req, res) {
    try {
      const latestPets = await Pet.find().sort({ createdAt: -1 }).limit(10); // example logic
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

    const { name, breed, age, weight, photos, specialNeeds, temperament,
            activityLevel, socialisation, favoriteActivities, location } = req.body;

    try {
      const pet = await Pet.create({
        name,
        breed,
        age,
        weight,
        photos: photos ?? [],
        specialNeeds,
        temperament,
        activityLevel,
        socialisation,
        favoriteActivities: favoriteActivities ?? [],
        location,
        owner: req.userId,
        creator: req.userId,
      });

      // Link it to the owner. $addToSet keeps this safe to retry.
      await User.updateOne({ _id: req.userId }, { $addToSet: { pets: pet._id } });

      // Matching is best-effort: a pet that saved must not fail the request
      // because the matcher had a problem.
      let matches = [];
      try {
        const isSubscribed = await SubscriptionController.checkSubscriptionStatus(
          req.userId
        );
        matches = (await PetMatchController.matchPets(pet._id, isSubscribed)) ?? [];
      } catch (error) {
        console.warn("[pets] Matching failed for new pet:", error.message);
      }

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

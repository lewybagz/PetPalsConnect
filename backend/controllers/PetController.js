const Pet = require("../models/Pet");
const SubscriptionController = require("./SubscriptionController");
const PetMatchController = require("./PetMatchController");

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
      const pet = await Pet.findById(req.params.id);
      if (pet == null) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      res.json(pet);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async updatePet(req, res) {
    let pet;
    try {
      pet = await Pet.findById(req.params.id);
      if (pet == null) {
        return res.status(404).json({ message: "Cannot find pet" });
      }

      if (req.body.name != null) {
        pet.name = req.body.name;
      }
      // Add additional fields here as needed

      const updatedPet = await pet.save();
      res.json(updatedPet);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async deletePet(req, res) {
    try {
      const pet = await Pet.findById(req.params.id);
      if (pet == null) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      await pet.remove();
      res.json({ message: "Deleted Pet" });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createPet(req, res) {
    const petData = req.body;
    const pet = new Pet(petData);

    try {
      await pet.save(); // Save the new pet to the database
      // Fetch the subscription status of the pet owner
      const isSubscribed = await SubscriptionController.checkSubscriptionStatus(
        pet.owner
      );
      // Run the matching algorithm
      const matches = await PetMatchController.matchPets(pet._id, isSubscribed);
      // Send back the newly created pet and its matches
      res.status(201).json({ pet, matches });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = PetController;

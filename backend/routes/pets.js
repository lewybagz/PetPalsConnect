// petRoutes.js
const express = require("express");
const router = express.Router();
const PetController = require("../controllers/PetController");

// GET all pets
router.get("/", PetController.getAllPets);

// GET a single pet by id
router.get("/:petId", PetController.getPetById);

// POST a new pet and run the matching algorithm
router.post("/", PetController.createPet);

// PUT update a pet
router.put("/:petId", PetController.updatePet);

router.get("/latest", PetController.getLatestPets);

router.get("/favorites/:userId", PetController.getUserFavorites);

router.get("/owner/:id", PetController.getPetOwnerById);

// DELETE a pet
router.delete("/:petId", PetController.deletePet);

module.exports = router;

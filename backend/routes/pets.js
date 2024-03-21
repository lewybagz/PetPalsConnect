// petRoutes.js
const express = require("express");
const router = express.Router();
const PetController = require("../controllers/PetController");

// GET all pets
router.get("/", PetController.getAllPets);

// GET a single pet by id
router.get("/:id", PetController.getPetById);

// POST a new pet and run the matching algorithm
router.post("/", PetController.createPet);

// PUT update a pet
router.put("/:id", PetController.updatePet);

// DELETE a pet
router.delete("/:id", PetController.deletePet);

module.exports = router;

const express = require("express");
const router = express.Router();
const PetMatchController = require("../controllers/PetMatchController");

// GET all PetMatches
router.get("/", PetMatchController.getAllPetMatches);

// GET a single PetMatch by ID
router.get("/:id", PetMatchController.getPetMatchById, (req, res) => {
  res.json(res.petMatch);
});

// POST to match pets
router.post("/match", PetMatchController.matchPets);

// POST to match pets
router.post("/match", PetMatchController.matchPetsHandler);

// POST a new PetMatch
router.post("/", PetMatchController.createPetMatch);

module.exports = router;

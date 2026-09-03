const express = require("express");
const router = express.Router();
const PetMatchController = require("../controllers/PetMatchController");

// Mounted at /api/petmatches. "/petmatches/:userId" repeated the mount prefix.
router.get("/", PetMatchController.getAllPetMatches);
router.get("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/match", PetMatchController.matchPets);
router.post("/", PetMatchController.createPetMatch);

router.get("/user/:userId", PetMatchController.getPetMatchesByUser);
router.get("/:id", PetMatchController.getPetMatchById, (req, res) => {
  res.json(res.petMatch);
});

module.exports = router;

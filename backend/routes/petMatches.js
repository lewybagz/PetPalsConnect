const express = require("express");
const router = express.Router();
const PetMatchController = require("../controllers/PetMatchController");

// Mounted at /api/petmatches. Static paths before parameterised ones.
router.get("/", PetMatchController.getAllPetMatches);
router.get("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/match", PetMatchController.runMatchingHandler);
router.post("/", PetMatchController.createPetMatch);

router.get("/explain/:petId/:otherPetId", PetMatchController.explainMatch);
router.get("/user/:userId", PetMatchController.getPetMatchesByUser);
router.get("/:id", PetMatchController.getPetMatchById, (req, res) =>
  res.json(res.petMatch)
);

module.exports = router;

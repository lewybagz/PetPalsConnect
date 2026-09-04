const express = require("express");
const router = express.Router();
const PetMatchController = require("../controllers/PetMatchController");

// Mounted at /api/petmatches. Static paths before parameterised ones.
router.get("/", PetMatchController.getAllPetMatches);
router.get("/discover", PetMatchController.discover);
router.post("/decide", PetMatchController.decide);
router.get("/map", PetMatchController.mapPets);
router.get("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/matched-pets", PetMatchController.matchPetsHandler);
router.post("/match", PetMatchController.runMatchingHandler);
router.post("/", PetMatchController.createPetMatch);

router.get("/explain/:petId/:otherPetId", PetMatchController.explainMatch);
// `GET /user/:userId` is gone: it read `relevantToUser: req.params.userId`, so
// any signed-in account could list anybody else's matches - and `GET /` already
// returns the caller's, scoped to the token.
router.get("/:id", PetMatchController.getPetMatchById, (req, res) =>
  res.json(res.petMatch)
);

module.exports = router;

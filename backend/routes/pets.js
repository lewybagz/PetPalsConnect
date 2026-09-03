const express = require("express");
const router = express.Router();
const PetController = require("../controllers/PetController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", PetController.getAllPets);
router.get("/latest", PetController.getLatestPets);
router.get("/favorites/:userId", PetController.getUserFavorites);
router.get("/owner/:id", PetController.getPetOwnerById);
router.post("/", PetController.createPet);

router.get("/:petId", PetController.getPetById);
router.put("/:petId", PetController.updatePet);
router.delete("/:petId", PetController.deletePet);

module.exports = router;

const express = require("express");
const router = express.Router();
const PetController = require("../controllers/PetController");
const HealthRecordController = require("../controllers/HealthRecordController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", PetController.getAllPets);
router.get("/latest", PetController.getLatestPets);
router.get("/favorites/:userId", PetController.getUserFavorites);
router.get("/owner/:id", PetController.getPetOwnerById);
router.post("/", PetController.createPet);

// Vaccination records. The status is readable by anyone signed in - it is
// what the deck shows - and the records only by the owner.
router.get("/:petId/health/status", HealthRecordController.getStatus);
router.get("/:petId/health", HealthRecordController.listRecords);
router.post("/:petId/health", HealthRecordController.createRecord);
router.delete("/:petId/health/:recordId", HealthRecordController.deleteRecord);

router.get("/:petId", PetController.getPetById);
router.put("/:petId", PetController.updatePet);
router.delete("/:petId", PetController.deletePet);

module.exports = router;

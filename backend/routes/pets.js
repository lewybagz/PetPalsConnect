const express = require("express");
const router = express.Router();
const PetController = require("../controllers/PetController");
const HealthRecordController = require("../controllers/HealthRecordController");
const WeightController = require("../controllers/WeightController");

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
router.post("/:petId/health/:recordId/done", HealthRecordController.markDone);
router.delete("/:petId/health/:recordId", HealthRecordController.deleteRecord);

// Weight history. A series of numbers rather than a series of dates, so its
// own model - see WeightEntry for why it is not a HealthRecord kind.
router.get("/:petId/weight", WeightController.listEntries);
router.post("/:petId/weight", WeightController.createEntry);
router.delete("/:petId/weight/:entryId", WeightController.deleteEntry);

router.get("/:petId", PetController.getPetById);
router.put("/:petId", PetController.updatePet);
router.delete("/:petId", PetController.deletePet);

module.exports = router;

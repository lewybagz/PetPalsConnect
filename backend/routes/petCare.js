const express = require("express");
const router = express.Router();
const PetCareController = require("../controllers/PetCareController");

// Product recommendations for the caller's own pets. The hub's *places* half
// lives on /api/locations/care, because those are Location rows and belong
// with the model and the geo index that serve them.
router.get("/picks", PetCareController.getPicks);

// The poison table, served whole so the app can cache it and answer offline.
// Not a search endpoint: the one screen that has to work on one bar of signal
// should not need a round trip to say whether grapes are a problem.
router.get("/toxins", PetCareController.getToxins);
router.get("/help", PetCareController.getHelp);

// The lost-pet checklist, with the caller's own chip numbers alongside it.
router.get("/lost-pet", PetCareController.getLostPet);

module.exports = router;

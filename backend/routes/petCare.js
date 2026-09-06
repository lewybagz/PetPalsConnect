const express = require("express");
const router = express.Router();
const PetCareController = require("../controllers/PetCareController");

// Product recommendations for the caller's own pets. The hub's *places* half
// lives on /api/locations/care, because those are Location rows and belong
// with the model and the geo index that serve them.
router.get("/picks", PetCareController.getPicks);

module.exports = router;

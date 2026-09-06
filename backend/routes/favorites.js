const express = require("express");
const router = express.Router();
const FavoriteController = require("../controllers/FavoriteController"); // Adjust the path as necessary

// Route to get all favorites
router.get("/", FavoriteController.getAllFavorites);

// Static paths before the parameterised one, or `/:id` swallows them.

// Saving a place - a vet, a groomer, a park - from the care hub.
router.post("/places", FavoriteController.createPlaceFavorite);
router.delete("/place/:locationId", FavoriteController.removePlaceFavorite);

// Route to create a new favorite
router.post("/", FavoriteController.createFavorite);
router.delete("/pet/:petId", FavoriteController.removeFavorite);

// Route to get a specific favorite by ID
router.get("/:id", FavoriteController.getFavoriteById);

module.exports = router;

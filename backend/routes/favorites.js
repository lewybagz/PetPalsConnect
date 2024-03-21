const express = require("express");
const router = express.Router();
const FavoriteController = require("../controllers/FavoriteController"); // Adjust the path as necessary

// Route to get all favorites
router.get("/", FavoriteController.getAllFavorites);

// Route to get a specific favorite by ID
router.get("/:id", FavoriteController.getFavoriteById);

// Route to create a new favorite
router.post("/", FavoriteController.createFavorite);

module.exports = router;

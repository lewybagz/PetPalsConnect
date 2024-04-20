const express = require("express");
const router = express.Router();
const SupportMessageController = require("../controllers/SupportMessageController");

// POST a new support message
router.post("/", SupportMessageController.createSupportMessage);

// GET all support messages
router.get("/", SupportMessageController.getAllSupportMessages);

// GET a single support message by ID
router.get("/:id", SupportMessageController.getSupportMessageById);

// Update a support message
router.put("/:id", SupportMessageController.updateSupportMessage);

// Delete a support message
router.delete("/:id", SupportMessageController.deleteSupportMessage);
// Additional routes for other CRUD operations can be added here using SupportMessageController methods

module.exports = router;

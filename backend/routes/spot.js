const express = require("express");
const router = express.Router();
const SpotController = require("../controllers/SpotController");
const { requireModerator } = require("../services/moderation");

// Mounted at /api/spot. Static paths before parameterised ones.
router.get("/status", SpotController.getStatus);
router.post("/consent", SpotController.consent);
// Flagged answers across accounts: a moderator's read, and GUARDED_READS in
// services/authAudit.js fails if this line stops carrying the guard.
router.get("/flagged", requireModerator, SpotController.getFlagged);

router.get("/conversations", SpotController.listConversations);
router.post("/conversations", SpotController.createConversation);
router.get("/conversations/:id", SpotController.getConversation);
router.delete("/conversations/:id", SpotController.deleteConversation);
router.post("/conversations/:id/messages", SpotController.sendMessage);
router.post("/conversations/:id/messages/:messageId/flag", SpotController.flagMessage);

module.exports = router;

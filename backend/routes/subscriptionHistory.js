// Note: Ensure authentication middleware is in place to populate req.user

const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription"); // Make sure the path is correct for your Subscription model

// Endpoint to get subscription history
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const history = await Subscription.find({ User: userId }).sort({
      StartDate: -1,
    });
    res.json(history);
  } catch (error) {
    console.error("[subscription-history]", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

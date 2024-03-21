// Note: Ensure authentication middleware is in place to populate req.user

const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription"); // Make sure the path is correct for your Subscription model

// Endpoint to get subscription history
router.get("/subscription-history", async (req, res) => {
  try {
    // TODO: Ensure you have user identification logic (e.g., via authentication middleware)
    const userId = req.user._id;
    const history = await Subscription.find({ user: userId }).sort({
      startDate: -1,
    });
    res.json(history);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

module.exports = router;

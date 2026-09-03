const express = require("express");
const MediaController = require("../controllers/MediaController");

const router = express.Router();

router.get("/:id", MediaController.getMediaDetails);

module.exports = router;

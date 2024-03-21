const express = require("express");
const router = express.Router();
const ServiceController = require("../controllers/ServiceController");

// GET all Services
router.get("/", ServiceController.getAllServices);

// GET a single Service by ID
router.get("/:id", ServiceController.getServiceById, (req, res) => {
  res.json(res.service);
});

// POST a new Service
router.post("/", ServiceController.createService);

module.exports = router;

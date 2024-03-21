const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/ReviewController");

// GET all Reviews
router.get("/", ReviewController.getAllReviews);

// GET a single Review by ID
router.get("/:id", ReviewController.getReviewById, (req, res) => {
  res.json(res.review);
});

router.patch("/:id/visibility", ReviewController.updateReviewVisibility);

router.get(
  "/reviews/location/:locationId",
  ReviewController.getReviewsByLocation
);

// POST a new Review
router.post("/", ReviewController.createReview);

module.exports = router;

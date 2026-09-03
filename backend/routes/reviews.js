const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/ReviewController");

// Mounted at /api/reviews. "/reviews/location/:locationId" repeated the mount
// prefix, so the app's /api/reviews/location/:id calls never matched.
router.get("/", ReviewController.getAllReviews);
router.get("/location/:locationId", ReviewController.getReviewsByLocation);
router.post("/", ReviewController.createReview);

router.patch("/:id/visibility", ReviewController.updateReviewVisibility);
router.get("/:id", ReviewController.getReviewById, (req, res) => {
  res.json(res.review);
});

module.exports = router;

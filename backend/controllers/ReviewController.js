const Review = require("../models/Review");
const Pet = require("../models/Pet");

const ReviewController = {
  async getAllReviews(req, res) {
    try {
      // Was `find()` with no filter: behind `authenticate`, but that only means
      // you need *an* account, not that the rows are yours. Reviews *of a place* are public and
      // are served by `getReviewsByLocation`; this is "my reviews".
      const reviews = await Review.find({ reviewer: req.userId })
        .populate("relatedArticle")
        .populate("relatedPlaydate")
        .populate("relatedService");
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getReviewById(req, res, next) {
    let review;
    try {
      review = await Review.findById(req.params.id)
        .populate("relatedArticle")
        .populate("relatedPlaydate")
        .populate("relatedService")
        .populate("reviewer")
        .populate("creator");
      if (review == null) {
        return res.status(404).json({ message: "Cannot find review" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.review = review;
    next();
  },

  async updateReviewVisibility(req, res) {
    try {
      const reviewId = req.params.id;
      const { Visibility } = req.body;

      const updatedReview = await Review.findByIdAndUpdate(
        reviewId,
        { Visibility: Visibility },
        { new: true }
      );

      if (!updatedReview) {
        return res.status(404).send({ message: "Review not found" });
      }

      res.send(updatedReview);
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  },

  async getReviewsByLocation(req, res) {
    try {
      const locationId = req.params.locationId;
      const reviews = await Review.find({ relatedLocation: locationId }) // Now referencing the relatedLocation field
        .populate("reviewer")
        .populate("creator"); // Add other necessary populate methods

      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  /** The user who owns a pet. Threw "Cannot access 'pet' before
   * initialization" on every call, and returned undefined for a missing pet. */
  async getOwnerIdFromPetId(petId) {
    const pet = await Pet.findById(petId).select("owner").lean();
    return pet?.owner ?? null;
  },

  async createReview(req, res) {
    const review = new Review({
      comment: req.body.comment,
      date: req.body.date,
      rating: req.body.rating,
      relatedArticle: req.body.relatedArticle,
      relatedPlaydate: req.body.relatedPlaydate,
      relatedService: req.body.relatedService,
      // Identity comes from the verified token, never the request body.
      reviewer: req.userId,
      visibility: req.body.visibility,
      creator: req.userId,
      slug: req.body.slug,
    });

    try {
      const newReview = await review.save();
      res.status(201).json(newReview);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ReviewController;

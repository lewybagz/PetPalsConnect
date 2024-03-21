const Review = require("../models/Review");

const ReviewController = {
  async getAllReviews(req, res) {
    try {
      const reviews = await Review.find()
        .populate("RelatedArticle")
        .populate("RelatedPlaydate")
        .populate("RelatedService")
        .populate("Reviewer")
        .populate("Creator");
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getReviewById(req, res, next) {
    let review;
    try {
      review = await Review.findById(req.params.id)
        .populate("RelatedArticle")
        .populate("RelatedPlaydate")
        .populate("RelatedService")
        .populate("Reviewer")
        .populate("Creator");
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
      const reviews = await Review.find({ RelatedLocation: locationId }) // Now referencing the RelatedLocation field
        .populate("Reviewer")
        .populate("Creator"); // Add other necessary populate methods

      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getOwnerIdFromPetId(petId) {
    const pet = await pet.findById(petId).exec(); // Pet is your Pet model
    return pet.owner; // Assuming 'owner' is a field in Pet schema referencing User
  },

  async createReview(req, res) {
    const review = new Review({
      Comment: req.body.Comment,
      Date: req.body.Date,
      Rating: req.body.Rating,
      RelatedArticle: req.body.RelatedArticle,
      RelatedPlaydate: req.body.RelatedPlaydate,
      RelatedService: req.body.RelatedService,
      Reviewer: req.body.Reviewer,
      Visibility: req.body.Visibility,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
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

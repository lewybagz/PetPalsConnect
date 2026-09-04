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
      // `.populate("reviewer")` with no projection returned the whole user
      // document on a public read - email, firebaseUid and the device's FCM
      // token included.
      review = await Review.findById(req.params.id)
        .populate("relatedArticle")
        .populate("relatedPlaydate")
        .populate("relatedService")
        .populate("reviewer", "username userPhoto");
      if (review == null) {
        return res.status(404).json({ message: "Cannot find review" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.review = review;
    next();
  },

  /**
   * Shows or hides one of the caller's own reviews.
   *
   * `Visibility` is not a path - the schema has `visibility` - so strict mode
   * dropped the key and `findByIdAndUpdate` changed nothing while answering
   * with the unchanged document, which reads exactly like success. It was also
   * addressed by id alone, so it would have hidden anybody's review.
   */
  async updateReviewVisibility(req, res) {
    try {
      const visibility = req.body.visibility ?? req.body.Visibility;

      const updatedReview = await Review.findOneAndUpdate(
        { _id: req.params.id, reviewer: req.userId },
        { visibility: Boolean(visibility), modifiedDate: new Date() },
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
      // Hidden reviews are hidden. And the reviewer is projected: this
      // returned every field of their user document to anybody who asked a
      // location for its reviews.
      const reviews = await Review.find({
        relatedLocation: locationId,
        visibility: { $ne: false },
      })
        .populate("reviewer", "username userPhoto")
        .sort({ date: -1 });

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
      // Never set, so a review of a place could not be attached to one and
      // `getReviewsByLocation` had nothing to find.
      relatedLocation: req.body.relatedLocation,
      // Identity comes from the verified token, never the request body.
      reviewer: req.userId,
      visibility: req.body.visibility !== false,
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

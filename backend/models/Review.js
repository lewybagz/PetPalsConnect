const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Review
const ReviewSchema = new Schema({
  comment: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  rating: {
    type: Number,
    required: true,
  },
  relatedArticle: {
    type: Schema.Types.ObjectId,
    ref: "Article", // Replace with the actual Article model reference
  },
  relatedPlaydate: {
    type: Schema.Types.ObjectId,
    ref: "Playdate", // Link to Playdate
  },
  relatedService: {
    type: Schema.Types.ObjectId,
    ref: "Service", // Assuming 'Service' is another schema/model we created
  },
  relatedLocation: {
    type: Schema.Types.ObjectId,
    ref: "Location", // Assuming 'Location' is your location model
  },
  reviewer: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  visibility: {
    type: Boolean,
    default: true, // true for 'yes', false for 'no'
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  slug: String,
});

// Create a model
const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;

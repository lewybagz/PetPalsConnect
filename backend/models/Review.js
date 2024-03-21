const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Review
const ReviewSchema = new Schema({
  Comment: {
    type: String,
    required: true,
  },
  Date: {
    type: Date,
    default: Date.now,
  },
  Rating: {
    type: Number,
    required: true,
  },
  RelatedArticle: {
    type: Schema.Types.ObjectId,
    ref: "Article", // Replace with the actual Article model reference
  },
  RelatedPlaydate: {
    type: Schema.Types.ObjectId,
    ref: "Playdate", // Link to Playdate
  },
  RelatedService: {
    type: Schema.Types.ObjectId,
    ref: "Service", // Assuming 'Service' is another schema/model we created
  },
  RelatedLocation: {
    type: Schema.Types.ObjectId,
    ref: "Location", // Assuming 'Location' is your location model
  },
  Reviewer: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Visibility: {
    type: Boolean,
    default: true, // true for 'yes', false for 'no'
  },
  Creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ModifiedDate: {
    type: Date,
    default: Date.now,
  },
  CreatedDate: {
    type: Date,
    default: Date.now,
  },
  Slug: String,
});

// Create a model
const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;

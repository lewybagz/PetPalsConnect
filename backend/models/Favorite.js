const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema for Favorite
const FavoriteSchema = new Schema({
  content: {
    type: Schema.Types.ObjectId,
    ref: "Content",
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  pet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
    required: true,
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
const Favorite = mongoose.model("Favorite", FavoriteSchema);

module.exports = Favorite;

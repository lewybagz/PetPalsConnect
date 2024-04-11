const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define a GeoSchema for storing GeoJSON (Point)
const GeoSchema = new Schema({
  type: {
    type: String,
    default: "Point",
  },
  coordinates: {
    type: [Number],
    index: "2dsphere",
  },
});

// Create Schema for Location
const LocationSchema = new Schema({
  address: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  photo: {
    type: String,
  },
  rating: {
    type: Number,
    required: false,
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
      required: false,
    },
  ],
  placeId: {
    type: String,
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
  slug: {
    type: String,
    required: false,
  },
  geoLocation: GeoSchema,
});

const Location = mongoose.model("Location", LocationSchema);

module.exports = Location;

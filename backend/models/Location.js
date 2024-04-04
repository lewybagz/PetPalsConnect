const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define a GeoSchema for storing GeoJSON (Point)
const GeoSchema = new Schema({
  type: {
    type: String,
    default: "Point",
  },
  coordinates: {
    type: [Number], // format will be [longitude, latitude]
    index: "2dsphere", // Create a geospatial index
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
    type: String, // URL to the image
  },
  rating: {
    type: Number,
  },
  reviews: [
    {
      type: String, // or ObjectId references to a 'Review' model
    },
  ],
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
  // Add the GeoSchema to store location coordinates
  geoLocation: GeoSchema,
});

// Create a model
const Location = mongoose.model("Location", LocationSchema);

module.exports = Location;

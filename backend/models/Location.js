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
  Address: {
    type: String,
    required: true,
  },
  Description: {
    type: String,
  },
  Photo: {
    type: String, // URL to the image
  },
  Rating: {
    type: Number,
  },
  Reviews: [
    {
      type: String, // or ObjectId references to a 'Review' model
    },
  ],
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
  // Add the GeoSchema to store location coordinates
  GeoLocation: GeoSchema,
});

// Create a model
const Location = mongoose.model("Location", LocationSchema);

module.exports = Location;

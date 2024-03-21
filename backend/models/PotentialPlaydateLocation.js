const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PotentialPlaydateLocationSchema = new Schema({
  // The name of the location
  Name: {
    type: String,
    required: true,
  },
  // Detailed address
  Address: {
    type: String,
    required: true,
  },
  // The place's unique identifier from Google Places API
  PlaceId: {
    type: String,
    required: true,
  },
  // GeoJSON format for location
  GeoLocation: {
    type: {
      type: String,
      default: "Point",
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
  },
  // URL to the photo of the location (if available)
  Photo: {
    type: String,
  },
  // Additional descriptive information
  Description: {
    type: String,
  },
  // Creator of the location entry
  Creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // Additional fields like ratings, reviews, etc., can be added
});

const PotentialPlaydateLocation = mongoose.model(
  "PotentialPlaydateLocation",
  PotentialPlaydateLocationSchema
);
module.exports = PotentialPlaydateLocation;

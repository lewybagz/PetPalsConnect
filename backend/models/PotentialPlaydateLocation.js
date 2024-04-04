const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PotentialPlaydateLocationSchema = new Schema({
  // The name of the location
  name: {
    type: String,
    required: true,
  },
  // Detailed address
  address: {
    type: String,
    required: true,
  },
  // The place's unique identifier from Google Places API
  placeId: {
    type: String,
    required: true,
  },
  // GeoJSON format for location
  geoLocation: {
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
  photo: {
    type: String,
  },
  // Additional descriptive information
  description: {
    type: String,
  },
  // Creator of the location entry
  creator: {
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

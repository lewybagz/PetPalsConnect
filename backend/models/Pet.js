const mongoose = require("mongoose");
const { ContentSchema } = require("./Content");
const Schema = mongoose.Schema;

// Create Schema for Pet
const PetSchema = new Schema(
  {
    age: {
      type: Number,
      required: true,
    },
    breed: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    photos: [
      {
        type: String,
      },
    ],
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: false,
    },
    playdates: [
      {
        type: Schema.Types.ObjectId,
        ref: "Playdate",
      },
    ],
    specialNeeds: {
      type: String,
    },
    temperament: {
      type: String,
    },
    weight: {
      type: Number,
      required: true,
    },
  },
  { discriminatorKey: "contentType" }
);

// The discriminator 'Pet' is used for the Pet type content
const Pet = ContentSchema.discriminator("Pet", PetSchema);

module.exports = Pet;

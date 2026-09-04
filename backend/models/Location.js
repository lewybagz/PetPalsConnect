const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

/**
 * A place two people can take their dogs.
 *
 * `name` is new and required. Every screen that renders a location shows one -
 * the map marker, the location list, the playdate summary - and the schema did
 * not have the field, so all of them rendered `undefined`. An address is not a
 * name: "Dolores Park" is what somebody recognises, "19th St & Dolores St" is
 * what they navigate to.
 *
 * There was a second model for this, `PotentialPlaydateLocation`, with the same
 * four fields and its own controller and routes. Nothing referenced it -
 * `Playdate.location` points here, and every screen fetches `/api/locations` -
 * so it was deleted rather than kept in step.
 */
const LocationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
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
  /** Google's id for the place, so an import can refresh it without duplicating. */
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
  /**
   * GeoJSON, so `[longitude, latitude]` - the opposite order to every UI that
   * displays it, and the single most common way to put a park in the sea.
   *
   * A sub-schema with `default: undefined`, not an inline object. Written
   * inline, the `type: "Point"` default materialises on every document, so a
   * place with no coordinates is stored as `{ type: "Point" }` - which the
   * 2dsphere index rejects outright ("Point must be an array or object"), and
   * the save fails with a message about geo keys on a document nobody meant to
   * put on a map.
   */
  geoLocation: {
    type: PointSchema,
    default: undefined,
  },
});

/**
 * Declared on the model rather than inside the sub-schema.
 *
 * A `2dsphere` index written as `index: "2dsphere"` on a nested path is not
 * reliably created, and `$nearSphere` without one does not fall back - it
 * errors. "Places near you" returning nothing looks like "there are none".
 */
LocationSchema.index({ geoLocation: "2dsphere" });

/** One row per place, so an import cannot fill the map with duplicates. */
LocationSchema.index({ placeId: 1 }, { unique: true });

const Location = mongoose.model("Location", LocationSchema);

module.exports = Location;

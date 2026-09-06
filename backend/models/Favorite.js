const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Something the caller saved.
 *
 * Two kinds, and exactly one of them per row: a pet from the deck, or a place
 * from the care hub. Saving a place is the thing an owner wants most from a
 * directory - "this is my vet" - and it did not fit: `pet` and `content` were
 * both required and `content` refs `Content`, which a Location is not. Rather
 * than a second favouriting mechanism on `User` (two homes for one question,
 * which is what this codebase keeps deleting), both targets live here and the
 * validator below insists on exactly one.
 *
 * `required` is a function on both, not `true`, so which one is mandatory
 * depends on the other - the same idiom `Media.thumbnail` and `Pet.breed` use,
 * and one `schemaAudit` deliberately skips.
 */
const FavoriteSchema = new Schema({
  content: {
    type: Schema.Types.ObjectId,
    ref: "Content",
    required: function contentUnlessPlace() {
      return !this.location;
    },
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  pet: {
    type: Schema.Types.ObjectId,
    ref: "Pet",
    required: function petUnlessPlace() {
      return !this.location;
    },
  },
  /** A park, vet, shop, groomer or boarder from the care hub. */
  location: {
    type: Schema.Types.ObjectId,
    ref: "Location",
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

/**
 * Exactly one target, never both and never neither.
 *
 * Without this a row with a pet *and* a location would satisfy every
 * `required` above and then be rendered twice - once on the Home shelf and
 * once in the hub - and a row with neither would satisfy them too, since each
 * excuses the other.
 */
FavoriteSchema.pre("validate", function exactlyOneTarget() {
  if (Boolean(this.pet) === Boolean(this.location)) {
    throw new Error(
      "A favourite is of a pet or of a place, not both and not neither"
    );
  }
});

/**
 * One row per person per thing, so a double tap is a double tap.
 *
 * Partial rather than plain: a pet favourite has no `location` and a place
 * favourite has no `pet`, and a plain unique index would treat every missing
 * value as the same null and let one person save exactly one of each.
 */
FavoriteSchema.index(
  { user: 1, pet: 1 },
  { unique: true, partialFilterExpression: { pet: { $exists: true } } }
);
FavoriteSchema.index(
  { user: 1, location: 1 },
  { unique: true, partialFilterExpression: { location: { $exists: true } } }
);

// Create a model
const Favorite = mongoose.model("Favorite", FavoriteSchema);

module.exports = Favorite;

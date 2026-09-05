const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Base Content schema
const ContentSchema = new Schema(
  {
    // common fields
    _id: { type: Schema.Types.ObjectId, auto: true },
    title: { type: String, required: true }, // Assuming all contents have a title
    createdAt: { type: Date, default: Date.now },
    // more common fields
  },
  { discriminatorKey: "contentType", collection: "contents" }
);

// Content model
const Content = mongoose.model("Content", ContentSchema);

// A citation on an article. Health-adjacent content that names a number has to
// be able to say where the number came from, or a reader has no way to check it
// and no way to tell a guideline from a blog post.
const ArticleSourceSchema = new Schema(
  {
    title: { type: String, required: true },
    publisher: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

// Article discriminator
const ArticleSchema = new Schema({
  /**
   * `author` and `creator` are optional on an article, and required nowhere
   * else this app writes content.
   *
   * Articles are editorial: `PUBLIC_READS` in `services/authAudit.js` describes
   * them as "editorial content, the same for everyone", and all three article
   * reads are unauthenticated for that reason. They are written by the
   * publication, not by a user account, so there is no `User` document to point
   * at - and requiring one meant seeded content could not be inserted without
   * first inventing a fake person who would then turn up in username search.
   *
   * They stay on the schema because an article created through `POST
   * /api/articles` by a signed-in author does have both, and `createArticle`
   * still sets `creator` from `req.userId`.
   */
  author: { type: Schema.Types.ObjectId, ref: "User" },
  creator: { type: Schema.Types.ObjectId, ref: "User" },

  /** The visible byline. Editorial content is bylined to the publication. */
  byline: { type: String, default: "PetPals Connect" },

  content: { type: String, required: true },
  /**
   * One or two sentences for the card. `ArticleCard` used to slice the first
   * 100 characters of `content`, which cuts mid-word and mid-clause.
   */
  summary: { type: String },
  imageUrl: { type: String },
  publishedDate: { type: Date, default: Date.now },
  /** When a human last checked the article's claims against its sources. */
  lastReviewedDate: { type: Date, default: Date.now },
  sources: [ArticleSourceSchema],
  tags: [{ type: String }],
  title: { type: String, required: true },
  modifiedDate: { type: Date, default: Date.now },
  /** Stable key for seeding: the seeder upserts on `slug`. */
  slug: { type: String, index: true },
});
const Article = Content.discriminator("Article", ArticleSchema);

// Pet discriminator
const PetSchema = new Schema({
  age: { type: Number, required: true },
  breed: { type: String, required: true },
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  photos: [{ type: String }],
  playdates: [{ type: Schema.Types.ObjectId, ref: "Playdate" }],
  specialNeeds: String,
  temperament: String,
  // Required: matching weighs size compatibility, so a pet without it cannot be
  // matched properly. Onboarding asks for it up front rather than leaving pets
  // in a state the matcher has to guess around.
  weight: { type: Number, required: true, min: 0 },
  activityLevel: { type: String, enum: ["low", "moderate", "high"] },
  socialisation: { type: String, enum: ["introvert", "balanced", "extrovert"] },
  favoriteActivities: [{ type: String }],
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  modifiedDate: { type: Date, default: Date.now },
  slug: String,
});

// `title` is required on the base Content schema and means nothing for a pet,
// so every pet insert failed validation - pet creation was impossible. Deriving
// it from the name keeps the shared Content contract satisfied without asking
// the client for a field it has no reason to know about.
PetSchema.pre("validate", function setTitleFromName() {
  if (!this.title && this.name) this.title = this.name;
});

const Pet = Content.discriminator("Pet", PetSchema);

module.exports = {
  Content,
  Article,
  Pet,
};

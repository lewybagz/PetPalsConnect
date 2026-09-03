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

// Article discriminator
const ArticleSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  publishedDate: { type: Date, default: Date.now },
  tags: [{ type: String }],
  title: { type: String, required: true },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  modifiedDate: { type: Date, default: Date.now },
  slug: String,
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
  // Optional so onboarding can ask for the minimum. It sharpens matching, so
  // the pet's detail screen prompts for it later.
  weight: { type: Number },
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

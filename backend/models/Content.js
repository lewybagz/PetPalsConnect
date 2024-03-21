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
  weight: { type: Number, required: true },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  modifiedDate: { type: Date, default: Date.now },
  slug: String,
});
const Pet = Content.discriminator("Pet", PetSchema);

module.exports = {
  Content,
  Article,
  Pet,
};

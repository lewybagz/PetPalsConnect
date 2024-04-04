const mongoose = require("mongoose");
const { ContentSchema } = require("./Content"); // Ensure Content.js exports ContentSchema

// Extend Content Schema for Article
const ArticleSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  publishedDate: {
    type: Date,
    default: Date.now,
  },
  tags: [
    {
      type: String,
    },
  ],
  title: {
    type: String,
    required: true,
  },
});

// Create Article model as a discriminator of Content
const Article = ContentSchema.discriminator("Article", ArticleSchema);

module.exports = Article;

const mongoose = require("mongoose");
const { ContentSchema } = require("./Content"); // Ensure Content.js exports ContentSchema

// Extend Content Schema for Article
const ArticleSchema = new mongoose.Schema({
  Content: {
    type: String,
    required: true,
  },
  PublishedDate: {
    type: Date,
    default: Date.now,
  },
  Tags: [
    {
      type: String,
    },
  ],
  Title: {
    type: String,
    required: true,
  },
});

// Create Article model as a discriminator of Content
const Article = ContentSchema.discriminator("Article", ArticleSchema);

module.exports = Article;

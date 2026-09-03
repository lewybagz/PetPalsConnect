// Article is a discriminator of the Content base model and is defined, once, in
// Content.js. See the note in Pet.js - this file had the same broken
// `ContentSchema.discriminator(...)` call and is now a re-export.
const { Article } = require("./Content");

module.exports = Article;

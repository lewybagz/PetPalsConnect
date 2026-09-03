const { Article } = require("../models/Content");

const ArticleController = {
  async getAllArticles(req, res) {
    try {
      const articles = await Article.find();
      res.json(articles);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getArticleById(req, res, next) {
    let article;
    try {
      article = await Article.findById(req.params.id);
      if (article == null) {
        return res.status(404).json({ message: "Cannot find article" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.article = article;
    next();
  },

  async getLatestArticles(req, res) {
    try {
      const articles = await Article.find()
        .sort({ PublishedDate: -1 })
        .limit(20);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async searchArticles(req, res) {
    try {
      const searchQuery = req.query.q || "";
      const articles = await Article.find({
        Title: { $regex: searchQuery, $options: "i" },
      });
      res.json(articles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getLatestArticle(req, res) {
    try {
      // The schema field is `publishedDate`. Sorting by `PublishedDate` sorts
      // on a path that does not exist, which Mongo accepts and ignores - so
      // "latest" returned whichever article happened to come first.
      const latestArticle = await Article.findOne().sort({ publishedDate: -1 });

      if (!latestArticle) {
        // No articles is an empty shelf on the home screen, not an error, and
        // a 404 here made the whole section fail rather than render empty.
        return res.json(null);
      }

      res.json(latestArticle);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async createArticle(req, res) {
    const article = new Article({
      title: req.body.title,
      Content: req.body.Content,
      PublishedDate: req.body.PublishedDate,
      Tags: req.body.Tags,
      contentType: "Article",
    });

    try {
      const newArticle = await article.save();
      res.status(201).json(newArticle);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = ArticleController;

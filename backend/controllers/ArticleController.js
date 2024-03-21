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

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
      // The schema field is `publishedDate`. Sorting on `PublishedDate` sorts
      // by a path no document has, which Mongo accepts and ignores - so
      // "latest" was whatever order the collection happened to return.
      const articles = await Article.find()
        .sort({ publishedDate: -1 })
        .limit(20);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async searchArticles(req, res) {
    try {
      const searchQuery = (req.query.q || "").trim();
      // An empty query used to build `{ $regex: "" }`, which matches
      // everything; the screen already falls back to /latest for that case,
      // but the route should not quietly return the whole collection either.
      if (!searchQuery) return res.json([]);

      // The schema fields are lowercase. `Title` is not a path, so this query
      // matched nothing and search returned an empty list for every term.
      // Escaped because a user's query is not a regular expression: a stray
      // "(" threw, and ".*" walked the whole collection.
      const pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const articles = await Article.find({
        $or: [
          { title: { $regex: pattern, $options: "i" } },
          { summary: { $regex: pattern, $options: "i" } },
          { tags: { $regex: pattern, $options: "i" } },
        ],
      })
        .sort({ publishedDate: -1 })
        .limit(50);
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
    // `Content`, `PublishedDate` and `Tags` were dropped by strict mode, and
    // `creator` was never set at all.
    //
    // `author` used to be set to `req.body.author ?? req.user?.username`. It is
    // an ObjectId ref, `req.user` does not exist on a request (the middleware
    // sets `req.firebaseUser` and `req.userId`), and a username is not an id -
    // so the assignment was a cast error waiting for the first caller who
    // passed a name. Identity comes from the token here as it does everywhere
    // else: the caller is the author.
    const article = new Article({
      title: req.body.title,
      content: req.body.content,
      summary: req.body.summary,
      imageUrl: req.body.imageUrl,
      byline: req.body.byline,
      sources: req.body.sources,
      author: req.userId,
      publishedDate: req.body.publishedDate ?? new Date(),
      tags: req.body.tags,
      creator: req.userId,
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

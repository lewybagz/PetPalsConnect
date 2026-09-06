const { Article } = require("../models/Content");

/**
 * A page size a client asked for, bounded.
 *
 * An unbounded `limit` from the query string is a way to ask the server to
 * serialise the whole corpus - 60 articles of a thousand words each - in one
 * response, which is a denial-of-service with extra steps.
 */
const clampLimit = (raw, fallback, max = 50) => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
};

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

  /**
   * The article list: newest first, paged, optionally filtered to one topic.
   *
   * The limit used to be a hardcoded 20 with no way to ask for the next page,
   * so the twenty-first article ever published became unreachable from the app
   * - visible only to somebody who guessed a word in its title. A corpus that
   * grows is a corpus that needs paging.
   */
  async getLatestArticles(req, res) {
    try {
      const limit = clampLimit(req.query.limit, 20);
      const skip = Math.max(0, Number.parseInt(req.query.skip, 10) || 0);

      // Tags are a controlled vocabulary written by the corpus, not free text,
      // but it still arrives from a client, so it is matched exactly rather
      // than as a pattern.
      const filter = {};
      const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
      if (tag) filter.tags = tag;

      const articles = await Article.find(filter)
        .sort({ publishedDate: -1 })
        .skip(skip)
        .limit(limit);
      res.json(articles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * The topics the corpus actually covers, with a count each.
   *
   * Derived from the articles rather than declared anywhere, so a tag cannot
   * exist in the browse UI with nothing behind it, and a new tag appears the
   * moment an article carrying it is seeded.
   */
  async getTopics(req, res) {
    try {
      const topics = await Article.aggregate([
        { $match: { contentType: "Article" } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]);

      res.json(topics.map(({ _id, count }) => ({ tag: _id, count })));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  /**
   * Other articles worth reading after this one.
   *
   * Ranked by how many tags they share, which is a crude measure and a good
   * enough one for a corpus this size: the alternative is a hand-maintained
   * list of relations that goes stale the first time somebody adds an article.
   */
  async getRelatedArticles(req, res) {
    try {
      const limit = clampLimit(req.query.limit, 3, 10);
      const article = await Article.findById(req.params.id).select("tags");
      if (!article) return res.status(404).json({ message: "Cannot find article" });

      const tags = article.tags ?? [];
      if (tags.length === 0) return res.json([]);

      const related = await Article.aggregate([
        { $match: { contentType: "Article", _id: { $ne: article._id }, tags: { $in: tags } } },
        { $addFields: { shared: { $size: { $setIntersection: ["$tags", tags] } } } },
        { $sort: { shared: -1, publishedDate: -1 } },
        { $limit: limit },
        // The card needs a title, a summary, an image and a date. Sending the
        // body as well would put three full articles on the wire to render
        // three headlines.
        { $project: { title: 1, summary: 1, imageUrl: 1, publishedDate: 1, slug: 1, tags: 1 } },
      ]);

      res.json(related);
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
        .limit(clampLimit(req.query.limit, 50, 100));
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

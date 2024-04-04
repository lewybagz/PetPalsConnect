const express = require("express");
const router = express.Router();
const ArticleController = require("../controllers/ArticleController");

// GET all Articles
router.get("/", ArticleController.getAllArticles);

// GET a single Article by ID
router.get("/:id", ArticleController.getArticleById, (req, res) => {
  res.json(res.article);
});

router.get("/latest", ArticleController.getLatestArticle);

// Endpoint to get the latest 20 articles
router.get("/latest", ArticleController.getLatestArticles);

router.get("/search", ArticleController.searchArticles);

// POST a new Article
router.post("/", ArticleController.createArticle);

module.exports = router;

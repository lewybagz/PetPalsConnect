const express = require("express");
const router = express.Router();
const ArticleController = require("../controllers/ArticleController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", ArticleController.getAllArticles);
router.get("/latest", ArticleController.getLatestArticles);
router.get("/search", ArticleController.searchArticles);
router.post("/", ArticleController.createArticle);

router.get("/:id", ArticleController.getArticleById, (req, res) => {
  res.json(res.article);
});

module.exports = router;

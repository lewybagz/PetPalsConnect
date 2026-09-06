const express = require("express");
const router = express.Router();
const ArticleController = require("../controllers/ArticleController");

// Static paths are declared before parameterised ones: Express matches in
// registration order, so a leading "/:id" swallows literal segments like
// "/latest" and "/recent".

router.get("/", ArticleController.getAllArticles);
router.get("/latest", ArticleController.getLatestArticles);
// The home screen's article shelf shows exactly one article. `getLatestArticle`
// has always existed for it - `PUBLIC_READS` in services/authAudit.js even
// names it "the home screen's article shelf" - but it was never routed, so Home
// called /latest and got an array of twenty full articles, then handed the
// array to a card that reads `.title` off it. The card rendered blank, and the
// screen downloaded twenty article bodies to show one.
router.get("/recent", ArticleController.getLatestArticle);
router.get("/search", ArticleController.searchArticles);
// The browse index: which topics exist and how much is behind each one.
router.get("/topics", ArticleController.getTopics);
router.post("/", ArticleController.createArticle);

// Declared before "/:id" so the two-segment path is matched by its own
// handler rather than depending on how strictly Express treats a single
// parameter segment.
router.get("/:id/related", ArticleController.getRelatedArticles);

router.get("/:id", ArticleController.getArticleById, (req, res) => {
  res.json(res.article);
});

module.exports = router;

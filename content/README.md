# PetPalsConnect editorial content

Everything in this directory is the source material for the app's **Articles**
feature — `ArticlesScreen`, `ArticleDetailScreen`, and the "latest article"
shelf on `HomeScreen`, all backed by `GET /api/articles/*`.

```
content/
  research/     The verified facts, with citations. Read before writing.
    standards.md    Editorial and sourcing rules. Read this first.
    topics.md       The topic map, prioritised, mapped to app features.
    dogs.md         Verified claims: behaviour, play, safety, health
    cats.md         Verified claims: environment, introductions, play, health
    small-pets.md   Rabbits, guinea pigs, birds, reptiles
    cross-cutting.md  Toxins, ID, weight, trainers, ageing, adoption
  articles/     The finished articles, as seed-ready JSON.
    articles.json   The batch. One array of Article documents.
```

Seed them with `data-fetch-scripts/articles/seedArticles.js`.

## Why the research lives in the repo

The articles are health-adjacent and they are read by people who will act on
them. A claim in `articles.json` is a sentence with no evidence attached; the
same claim in `research/` names the study, the year and the number. When
somebody asks "where does 59% come from" — or when a guideline changes, which
they do — the answer has to be findable without re-running the research.

`research/` is therefore the durable artefact and `articles/` is a rendering of
it. Update the research first, then the article.

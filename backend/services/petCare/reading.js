const Article = require("../../models/Article");
const { lifeStage } = require("./recommend");

/**
 * Which articles belong beside a pet.
 *
 * The app has sixty researched articles and almost nobody reaches them: both
 * entry points live inside one conditional on Home, so a failed
 * `/api/articles/recent` hides the whole corpus. The research on content
 * libraries is blunt about the fix - a library surfaced contextually against
 * something the reader is already looking at earns its place, and a generic
 * content tab does not.
 *
 * So the care hub, which already knows the species, age and size of every pet
 * an owner has, gets three articles per pet.
 *
 * **This file is the one place the two species vocabularies meet.** Articles
 * are tagged editorially (`dogs`, `cats`, `small-pets`) and pets carry a
 * schema enum (`dog`, `cat`, `smallMammal`). They are deliberately different -
 * one is a browse index maintained by whoever writes the corpus, the other is
 * a field the matcher reads - and nothing mapped between them, so "articles
 * for your cat" could not be expressed at all. A translation written twice is
 * a translation one copy gets wrong, so it is written here and checked by a
 * test that every species resolves to a tag with articles behind it.
 */
const SPECIES_TAGS = {
  dog: "dogs",
  cat: "cats",
  smallMammal: "small-pets",
  bird: "birds",
  reptile: "reptiles",
  fish: "fish",
};

/**
 * The life-stage tags the corpus actually carries, per species. A stage with
 * no tag is left out rather than guessed at: `lifeStage` already returns null
 * for an unknown age, and the rule here is the same one `recommend.js` uses -
 * a recommendation for the wrong stage is worse than one not shown.
 */
const STAGE_TAGS = {
  dog: { young: "puppies", senior: "senior" },
  cat: { young: "kittens", senior: "senior" },
};

const ARTICLES_PER_PET = 3;

const tagForSpecies = (species) => SPECIES_TAGS[species] ?? SPECIES_TAGS.dog;

const tagForStage = (species, stage) => (stage ? STAGE_TAGS[species]?.[stage] ?? null : null);

/**
 * Three articles for one pet: species first, the pet's life stage preferred.
 *
 * Ranked in the database rather than in memory, and projected without the
 * body - three full article bodies on the wire to render three headlines is
 * the same mistake `/latest` made on the home screen.
 */
const forPet = async (pet, limit = ARTICLES_PER_PET) => {
  const speciesTag = tagForSpecies(pet.species);
  const stageTag = tagForStage(pet.species, lifeStage(pet.species, pet.age));

  const articles = await Article.find({ tags: speciesTag })
    .select("title summary slug tags publishedDate")
    .sort({ publishedDate: -1 })
    .lean();

  if (!articles.length) return [];

  // A stage-specific article first when there is one, newest otherwise. Sorted
  // here because the preference is a rank over two tags, not a filter: a puppy
  // owner should still see general dog articles once the puppy ones run out.
  const ranked = stageTag
    ? [...articles].sort((a, b) => {
        const aStage = a.tags.includes(stageTag) ? 0 : 1;
        const bStage = b.tags.includes(stageTag) ? 0 : 1;
        return aStage - bStage;
      })
    : articles;

  return ranked.slice(0, limit).map((article) => ({
    _id: String(article._id),
    title: article.title,
    summary: article.summary,
    slug: article.slug,
  }));
};

/** The same, for each of an owner's pets, keyed by pet id. */
const forPets = async (pets = []) => {
  const entries = await Promise.all(
    pets.map(async (pet) => [String(pet._id), await forPet(pet)])
  );
  return new Map(entries);
};

module.exports = { SPECIES_TAGS, STAGE_TAGS, ARTICLES_PER_PET, tagForSpecies, tagForStage, forPet, forPets };

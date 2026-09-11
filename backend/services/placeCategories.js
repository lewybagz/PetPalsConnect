/**
 * What kind of place a `Location` is.
 *
 * There used to be two models for this. `Location` had the geo index, the
 * unique `placeId` and the Google importer; `Service` was a stub with a String
 * address, no coordinates, an unconstrained `serviceType`, and a create route
 * any signed-in account could post to - a user-writable "directory of vets"
 * that `getAllServices` handed to everybody. Nothing in the app ever called it,
 * and the importer had been pulling `veterinary_care` and `pet_store` into
 * `Location` all along, so the vet directory already half-existed in the right
 * model while the wrong one was being ignored. `Service` is deleted, the way
 * `PotentialPlaydateLocation` was, rather than kept in step.
 *
 * A place can be more than one of these - plenty of vets board, and plenty of
 * pet shops groom - so `categories` is an array rather than a single type.
 */

/**
 * Playdates happen at a park; the care hub is about the next four; the last
 * three are where a dog goes *with* its owner - a patio, a hotel, a trail.
 * Those are "reported dog-friendly": Google has no dog-friendly type, so they
 * come from keyword searches and nothing here vouches for them.
 */
const CATEGORIES = ["park", "vet", "petStore", "groomer", "boarding", "patio", "hotel", "trail"];

/**
 * What to ask Google for, per category.
 *
 * `park`, `veterinary_care` and `pet_store` are real place types. Grooming and
 * boarding are not - Google has no type for either - so those two go out as a
 * keyword against the nearest type that does exist. That is why `category` is
 * carried through the search rather than being derived from the result's own
 * `types`: a groomer comes back typed `pet_store`, and without the category we
 * asked for there would be no way to tell it apart from a shop.
 */
const IMPORTS = [
  { category: "park", type: "park" },
  { category: "vet", type: "veterinary_care" },
  { category: "petStore", type: "pet_store" },
  { category: "groomer", type: "pet_store", keyword: "pet grooming" },
  { category: "boarding", type: "lodging", keyword: "pet boarding kennel" },
  // Out and about. All keyword searches: precision is what the keyword gives.
  { category: "patio", type: "restaurant", keyword: "dog friendly patio" },
  { category: "hotel", type: "lodging", keyword: "pet friendly hotel" },
  { category: "trail", type: "park", keyword: "dog friendly hiking trail" },
];

/** Google's own types, where one maps cleanly onto one of ours. */
const FROM_GOOGLE_TYPE = {
  park: "park",
  dog_park: "park",
  veterinary_care: "vet",
  pet_store: "petStore",
};

/**
 * The categories a result belongs to.
 *
 * Takes both the result's own `types` and the category the search was for,
 * because neither alone is enough: a keyword search for grooming returns
 * `pet_store`, and a vet that also boards is typed `veterinary_care` and
 * nothing else. Ordering is stable so an upsert does not rewrite the row on
 * every import.
 */
const categoriesFor = (googleTypes = [], searchedCategory = null) => {
  const found = new Set();

  for (const type of googleTypes) {
    const category = FROM_GOOGLE_TYPE[type];
    if (category) found.add(category);
  }
  if (searchedCategory && CATEGORIES.includes(searchedCategory)) {
    found.add(searchedCategory);
  }

  return CATEGORIES.filter((category) => found.has(category));
};

/**
 * Places somebody takes a pet *to* for care, as opposed to for a walk.
 *
 * The care hub lists these; the playdate location pickers want `park`.
 */
const CARE_CATEGORIES = ["vet", "petStore", "groomer", "boarding"];

/**
 * Places somebody takes a pet *with* them. Kept apart from the care list so
 * the default vet lookup does not fill with hotels, and so the hub can label
 * the section "reported dog-friendly" rather than imply it checked.
 */
const OUT_CATEGORIES = ["patio", "hotel", "trail"];

module.exports = {
  CATEGORIES,
  CARE_CATEGORIES,
  OUT_CATEGORIES,
  IMPORTS,
  FROM_GOOGLE_TYPE,
  categoriesFor,
};

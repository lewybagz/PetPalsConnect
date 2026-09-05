/**
 * The care hub's product recommendations.
 *
 * A source-controlled table, not a collection, for the same reasons
 * `notificationTypes.js`, `reportStates.js` and `emergency.js` are: it is not
 * user data, there is no admin console in this repo to edit it from, and a
 * change to what the app tells somebody to feed their dog ought to be a
 * reviewed diff rather than a POST. Nothing here is written at runtime, so
 * there is no create path, no auth-audit entry and no spam surface.
 *
 * Every entry is a *category* of thing to buy - "a puppy food", "a slow feeder
 * bowl" - with a search link, not a named product with an affiliate tag. That
 * is the whole design: the app is not paid to say any of this, and the moment
 * it is, that fact belongs on screen next to the link. `url` is a retailer
 * search rather than a product page so an out-of-stock SKU cannot turn a
 * recommendation into a dead end.
 *
 * ---------------------------------------------------------------------------
 * What this table must never do
 * ---------------------------------------------------------------------------
 * It must not give veterinary advice. Life stage and size are ordinary
 * shopping facts - a puppy eats puppy food, a 90lb dog needs a bigger crate -
 * and that is the whole basis on which anything here is selected. A pet's
 * `specialNeeds` is deliberately NOT an input to any pick: "diabetic",
 * "kidney disease" or "recovering from surgery" is a conversation with a vet,
 * and an app that answered it with a link to a bag of food would be doing
 * something it has no business doing. `recommend.js` routes that case to the
 * vet list instead.
 */

/**
 * Life stages, in the order a pet passes through them.
 *
 * The boundaries are approximate on purpose and differ by species, which is
 * why they are declared per species rather than as one global rule: a cat is
 * a kitten for about a year, a dog is a puppy for one to two depending on
 * breed size. Anything finer than this would be pretending to a precision the
 * app does not have - it knows an age in whole years and nothing else.
 */
const LIFE_STAGES = ["young", "adult", "senior"];

/** Where the young/adult and adult/senior boundaries fall, in years. */
const STAGE_BOUNDARIES = {
  dog: { adultFrom: 2, seniorFrom: 8 },
  cat: { adultFrom: 1, seniorFrom: 11 },
  smallMammal: { adultFrom: 1, seniorFrom: 4 },
  bird: { adultFrom: 1, seniorFrom: 8 },
  reptile: { adultFrom: 2, seniorFrom: 10 },
  fish: { adultFrom: 1, seniorFrom: 5 },
};

/**
 * Size bands for the species that have a weight.
 *
 * Only dogs and cats store one - the schema requires `weight` for those two
 * and nothing else - so only those two get a size-dependent pick. A band of
 * `null` on a pick means it does not depend on size.
 */
const SIZE_BANDS = {
  dog: [
    { size: "small", upToPounds: 25 },
    { size: "medium", upToPounds: 60 },
    { size: "large", upToPounds: Infinity },
  ],
  cat: [
    { size: "small", upToPounds: 8 },
    { size: "medium", upToPounds: 14 },
    { size: "large", upToPounds: Infinity },
  ],
};

/** The shelves the hub groups picks under, in the order they are shown. */
const CATEGORIES = ["food", "supplies", "enrichment", "grooming", "health"];

const search = (query) =>
  `https://www.google.com/search?q=${encodeURIComponent(query)}`;

/**
 * The table.
 *
 * `species` and `stages` are the filters; `sizes` narrows further where a
 * species has a weight. `why` is shown to the owner, because a recommendation
 * that does not say why it is being made is indistinguishable from an advert.
 */
const PICKS = [
  // --- Dogs ----------------------------------------------------------------
  {
    id: "dog-puppy-food",
    species: "dog",
    stages: ["young"],
    category: "food",
    title: "Puppy food",
    why: "Puppies need more protein, fat and calcium per bite than adult food provides.",
    url: search("puppy food"),
  },
  {
    id: "dog-adult-food",
    species: "dog",
    stages: ["adult"],
    category: "food",
    title: "Adult dog food",
    why: "Formulated for a dog that has finished growing.",
    url: search("adult dog food"),
  },
  {
    id: "dog-senior-food",
    species: "dog",
    stages: ["senior"],
    category: "food",
    title: "Senior dog food",
    why: "Fewer calories and added joint support for a dog that has slowed down.",
    url: search("senior dog food"),
  },
  {
    id: "dog-harness-small",
    species: "dog",
    sizes: ["small"],
    category: "supplies",
    title: "Small-breed harness",
    why: "Spreads the pull across the chest, which matters most on a small neck.",
    url: search("small dog harness"),
  },
  {
    id: "dog-harness-large",
    species: "dog",
    sizes: ["medium", "large"],
    category: "supplies",
    title: "No-pull harness",
    why: "A front clip gives you steering on a dog strong enough to need it.",
    url: search("no pull dog harness large"),
  },
  {
    id: "dog-crate",
    species: "dog",
    category: "supplies",
    title: "Crate",
    why: "Sized so they can stand up and turn around - measure before buying.",
    url: search("dog crate"),
  },
  {
    id: "dog-puzzle-feeder",
    species: "dog",
    category: "enrichment",
    title: "Puzzle feeder",
    why: "Turns two minutes of eating into twenty of work, which tires a dog out.",
    url: search("dog puzzle feeder"),
  },
  {
    id: "dog-chew-toys",
    species: "dog",
    stages: ["young"],
    category: "enrichment",
    title: "Chew toys",
    why: "A teething puppy will chew something. Better it is this.",
    url: search("puppy chew toys"),
  },
  {
    id: "dog-nail-clippers",
    species: "dog",
    category: "grooming",
    title: "Nail clippers",
    why: "Nails you can hear on the floor are already too long.",
    url: search("dog nail clippers"),
  },
  {
    id: "dog-toothbrush",
    species: "dog",
    category: "health",
    title: "Toothbrush and dog toothpaste",
    why: "Dental disease is the most common thing vets find, and human toothpaste is not safe for dogs.",
    url: search("dog toothbrush toothpaste"),
  },

  // --- Cats ----------------------------------------------------------------
  {
    id: "cat-kitten-food",
    species: "cat",
    stages: ["young"],
    category: "food",
    title: "Kitten food",
    why: "Kittens roughly triple in weight in their first months and need the calories for it.",
    url: search("kitten food"),
  },
  {
    id: "cat-adult-food",
    species: "cat",
    stages: ["adult"],
    category: "food",
    title: "Adult cat food",
    why: "Cats are obligate carnivores - protein first, and taurine is not optional.",
    url: search("adult cat food taurine"),
  },
  {
    id: "cat-senior-food",
    species: "cat",
    stages: ["senior"],
    category: "food",
    title: "Senior cat food",
    why: "Easier to chew and gentler on ageing kidneys.",
    url: search("senior cat food"),
  },
  {
    id: "cat-litter-box",
    species: "cat",
    category: "supplies",
    title: "Litter box",
    why: "One per cat plus one, and bigger than you think - most sold are too small.",
    url: search("large litter box"),
  },
  {
    id: "cat-scratching-post",
    species: "cat",
    category: "enrichment",
    title: "Scratching post",
    why: "Tall enough for a full stretch, or they will use the sofa instead.",
    url: search("tall cat scratching post"),
  },
  {
    id: "cat-wand-toy",
    species: "cat",
    category: "enrichment",
    title: "Wand toy",
    why: "Lets an indoor cat finish a hunt, which is the part they actually want.",
    url: search("cat wand toy"),
  },
  {
    id: "cat-carrier",
    species: "cat",
    category: "supplies",
    title: "Top-loading carrier",
    why: "Getting a reluctant cat in through the top is far easier than through the end.",
    url: search("top loading cat carrier"),
  },
  {
    id: "cat-brush",
    species: "cat",
    category: "grooming",
    title: "Brush",
    why: "Less shedding, and fewer hairballs to find with your foot at night.",
    url: search("cat brush shedding"),
  },

  // --- Small mammals -------------------------------------------------------
  {
    id: "small-hay",
    species: "smallMammal",
    category: "food",
    title: "Timothy hay",
    why: "Rabbits and guinea pigs need unlimited hay - it wears their teeth down and keeps their gut moving.",
    url: search("timothy hay rabbit guinea pig"),
  },
  {
    id: "small-vitamin-c",
    species: "smallMammal",
    category: "health",
    title: "Vitamin C for guinea pigs",
    why: "Guinea pigs cannot make their own, and are one of the few animals that cannot.",
    url: search("guinea pig vitamin c supplement"),
  },
  {
    id: "small-enclosure",
    species: "smallMammal",
    category: "supplies",
    title: "A bigger enclosure",
    why: "Almost every cage sold as suitable is smaller than the minimum the species needs.",
    url: search("large rabbit guinea pig enclosure"),
  },
  {
    id: "small-bedding",
    species: "smallMammal",
    category: "supplies",
    title: "Paper bedding",
    why: "Pine and cedar shavings give off oils that irritate small airways.",
    url: search("paper bedding small pet"),
  },

  // --- Birds ---------------------------------------------------------------
  {
    id: "bird-pellets",
    species: "bird",
    category: "food",
    title: "Formulated pellets",
    why: "A seed-only diet is the most common cause of malnutrition in pet birds.",
    url: search("bird pellets formulated diet"),
  },
  {
    id: "bird-perches",
    species: "bird",
    category: "supplies",
    title: "Varied-width perches",
    why: "One dowel of one width all day is how birds get sore feet.",
    url: search("natural bird perches varied"),
  },
  {
    id: "bird-foraging-toys",
    species: "bird",
    category: "enrichment",
    title: "Foraging toys",
    why: "A bored parrot finds something to do, and you rarely like what it picks.",
    url: search("bird foraging toys"),
  },

  // --- Reptiles ------------------------------------------------------------
  {
    id: "reptile-uvb",
    species: "reptile",
    category: "supplies",
    title: "UVB lamp",
    why: "Most reptiles cannot process calcium without it, and bulbs stop emitting UVB long before they stop giving light.",
    url: search("reptile UVB lamp"),
  },
  {
    id: "reptile-thermometer",
    species: "reptile",
    category: "supplies",
    title: "Thermostat and thermometer",
    why: "A heat source without a thermostat is the usual cause of burns and of enclosures that run cold.",
    url: search("reptile thermostat thermometer"),
  },
  {
    id: "reptile-calcium",
    species: "reptile",
    category: "health",
    title: "Calcium supplement",
    why: "Dusting feeder insects is how most keepers prevent metabolic bone disease.",
    url: search("reptile calcium supplement D3"),
  },

  // --- Fish ----------------------------------------------------------------
  {
    id: "fish-test-kit",
    species: "fish",
    category: "health",
    title: "Water test kit",
    why: "Ammonia and nitrite kill far more fish than disease does, and neither is visible.",
    url: search("aquarium water test kit"),
  },
  {
    id: "fish-filter",
    species: "fish",
    category: "supplies",
    title: "Filter rated above your tank",
    why: "Filters are rated optimistically; one size up is the usual advice.",
    url: search("aquarium filter"),
  },
  {
    id: "fish-dechlorinator",
    species: "fish",
    category: "supplies",
    title: "Dechlorinator",
    why: "Tap water is treated to kill bacteria, including the ones your filter depends on.",
    url: search("aquarium water conditioner dechlorinator"),
  },
];

module.exports = {
  LIFE_STAGES,
  STAGE_BOUNDARIES,
  SIZE_BANDS,
  CATEGORIES,
  PICKS,
};

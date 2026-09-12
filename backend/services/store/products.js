/**
 * The shop's catalogue.
 *
 * A source-controlled table, for the reasons `petCare/picks.js`, `emergency.js`
 * and `notificationTypes.js` are: ten to twenty products, no admin console in
 * this repo to edit them from, and a change to what the app sells ought to be a
 * reviewed diff. Nothing writes it at runtime.
 *
 * ---------------------------------------------------------------------------
 * Stripe holds the price. This table holds everything else.
 * ---------------------------------------------------------------------------
 * A variant names a `sku`, and that sku is the *lookup key* of a Price in the
 * Stripe dashboard. Checkout resolves sku -> Price at request time and hands
 * Stripe the Price id and a quantity - never an amount. So there is no number
 * here that could be sent by a client, and no number here that could drift
 * from what Stripe charges. A sku with no matching Price is simply not for
 * sale yet, and `GET /api/store/products` says so per variant.
 *
 * ---------------------------------------------------------------------------
 * What this table must never do
 * ---------------------------------------------------------------------------
 * It must never grant an entitlement. Physical goods are sold through Stripe
 * because Apple 3.1.3(e) and Play's payments policy require it; anything that
 * unlocks in-app content has to go through native IAP (RevenueCat, here). A
 * product that did both would be digital content sold outside IAP, which is a
 * rejection on both stores. There is no `entitlement` field and
 * `store.test.js` asserts none appears.
 *
 * ---------------------------------------------------------------------------
 * The seam for a later admin portal
 * ---------------------------------------------------------------------------
 * Everything reads through `listProducts()` and `findVariant()`. Moving the
 * catalogue to Mongo is a change inside those two functions plus a migration,
 * not a change at each caller - which is the whole provision being made now.
 */

/** What a product is for. The shop groups by these, in this order. */
const CATEGORIES = ["tracking", "pets", "people"];

const CATEGORY_LABELS = {
  tracking: "Tracking",
  pets: "For your dog",
  people: "For you",
};

/**
 * The tracking collar is the one product with a second life after purchase:
 * once delivered it is claimed by serial on `PetTracking`, and the order screen
 * offers that step. `requiresDeviceSetup` is what tells it to.
 */
const PRODUCTS = [
  {
    id: "tracking-collar",
    category: "tracking",
    name: "PetPals Tracking Collar",
    // Never "keeps your pet safe". It is a locator that reports where a
    // device last was, and the terms say so in as many words.
    description:
      "A PetPals collar with a GPS tracker built in. See where the collar last reported on the map, and share that with friends in the app for as long as you choose.",
    photos: [],
    requiresDeviceSetup: true,
    variants: [
      { sku: "collar-tracker-s", label: "Small (10–14 in)" },
      { sku: "collar-tracker-m", label: "Medium (14–18 in)" },
      { sku: "collar-tracker-l", label: "Large (18–24 in)" },
    ],
  },
  {
    id: "bandana",
    category: "pets",
    name: "PetPals Bandana",
    description: "A cotton bandana with the PetPals paw, in three sizes.",
    photos: [],
    variants: [
      { sku: "bandana-s", label: "Small" },
      { sku: "bandana-m", label: "Medium" },
      { sku: "bandana-l", label: "Large" },
    ],
  },
  {
    id: "leash",
    category: "pets",
    name: "PetPals Leash",
    description: "A six-foot leash with a padded handle.",
    photos: [],
    variants: [{ sku: "leash-6ft", label: "6 ft" }],
  },
  {
    id: "treat-pouch",
    category: "pets",
    name: "Treat Pouch",
    description: "Clips to a belt or a leash. Fits a hand and a day's treats.",
    photos: [],
    variants: [{ sku: "treat-pouch", label: "One size" }],
  },
  {
    id: "tee",
    category: "people",
    name: "PetPals Tee",
    description: "A soft cotton tee with the PetPals paw on the chest.",
    photos: [],
    variants: [
      { sku: "tee-s", label: "S" },
      { sku: "tee-m", label: "M" },
      { sku: "tee-l", label: "L" },
      { sku: "tee-xl", label: "XL" },
    ],
  },
  {
    id: "hoodie",
    category: "people",
    name: "PetPals Hoodie",
    description: "A midweight hoodie for the early walk.",
    photos: [],
    variants: [
      { sku: "hoodie-s", label: "S" },
      { sku: "hoodie-m", label: "M" },
      { sku: "hoodie-l", label: "L" },
      { sku: "hoodie-xl", label: "XL" },
    ],
  },
  {
    id: "cap",
    category: "people",
    name: "PetPals Cap",
    description: "An adjustable cap with the paw stitched on the front.",
    photos: [],
    variants: [{ sku: "cap", label: "One size" }],
  },
];

/** The most of one variant a single order may hold. Merch, not wholesale. */
const MAX_QUANTITY = 10;

/** The most distinct lines in one order, for the same reason. */
const MAX_LINES = 10;

/** The catalogue, in display order. */
const listProducts = () =>
  [...PRODUCTS].sort(
    (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
  );

/** `{ product, variant }` for a sku, or null. */
const findVariant = (sku) => {
  for (const product of PRODUCTS) {
    const variant = product.variants.find((entry) => entry.sku === sku);
    if (variant) return { product, variant };
  }
  return null;
};

/** Every sku in the catalogue, for one Stripe lookup. */
const allSkus = () => PRODUCTS.flatMap((product) => product.variants.map((v) => v.sku));

module.exports = {
  CATEGORIES,
  CATEGORY_LABELS,
  PRODUCTS,
  MAX_QUANTITY,
  MAX_LINES,
  listProducts,
  findVariant,
  allSkus,
};

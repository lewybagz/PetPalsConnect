/**
 * The data the gallery renders the real screens against.
 *
 * Shaped like the API's actual responses - lowercase schema fields, `_id`,
 * `photos` as an array - because a fixture that invents a shape would hide
 * exactly the class of bug this codebase keeps finding: a screen reading
 * `pet.image` from a document that has `photos`.
 *
 * Photographs are data URIs rather than URLs. The container has no outbound
 * access to a photo host, and a screenshot full of broken-image boxes tells you
 * nothing about the layout.
 */

/** A flat colour block, so a card's photo area has something in it. */
const swatch = (hex) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${hex}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const PHOTOS = {
  bo: swatch("#B9C6A8"),
  sky: swatch("#C3B3D6"),
  rex: swatch("#D6C2A8"),
  me: swatch("#A8BFD6"),
};

export const MY_PET = {
  _id: "pet-mine",
  name: "Rex",
  breed: "Border Collie",
  age: 4,
  weight: 42,
  temperament: "Playful",
  favoriteActivities: ["Fetch", "Swimming"],
  photos: [PHOTOS.rex],
  owner: "user-me",
};

/** A second pet of the caller's, so "which of yours is coming" has a choice. */
export const SECOND_PET = {
  _id: "pet-mine-2",
  name: "Pepper",
  breed: "Cocker Spaniel",
  age: 2,
  weight: 28,
  photos: [PHOTOS.me],
  owner: "user-me",
};

export const CANDIDATES = [
  {
    pet: {
      _id: "pet-1",
      name: "Bo",
      breed: "Beagle",
      age: 3,
      weight: 24,
      photos: [PHOTOS.bo],
      owner: "user-1",
    },
    score: 82,
    breakdown: { temperament: 27, size: 21, activities: 22, breed: 8, age: 4 },
    distanceMiles: 2.4,
    vaccination: "current",
  },
  {
    pet: {
      _id: "pet-2",
      name: "Sky",
      breed: "Whippet",
      age: 2,
      weight: 31,
      photos: [PHOTOS.sky],
      owner: "user-2",
    },
    score: 61,
    breakdown: { temperament: 18, size: 19, activities: 14, breed: 6, age: 4 },
    distanceMiles: 7.1,
  },
];

/**
 * The inbox.
 *
 * `pets` carries both animals, with owners, because the row is titled by the
 * pet whose owner is not you - a conversation is between two pets, and an
 * inbox listing usernames is listing the people holding the leads. `me` is the
 * gallery's own user id, so one of each pair belongs to the viewer.
 */
export const CHATS = [
  {
    _id: "chat-1",
    participants: [
      { _id: "user-me", username: "you", userPhoto: PHOTOS.me },
      { _id: "user-1", username: "maya", userPhoto: PHOTOS.me },
    ],
    lastMessage: { contentText: "Bo would love that! Saturday morning?" },
    pets: [
      { _id: "pet-mine", name: "Rex", photos: [PHOTOS.me], owner: "user-me" },
      { _id: "pet-1", name: "Bo", photos: [PHOTOS.bo], owner: "user-1" },
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "chat-2",
    participants: [
      { _id: "user-me", username: "you", userPhoto: PHOTOS.me },
      { _id: "user-2", username: "dev", userPhoto: PHOTOS.me },
    ],
    lastMessage: { contentText: "Sky is a bit shy around bigger dogs" },
    pets: [
      { _id: "pet-mine", name: "Rex", photos: [PHOTOS.me], owner: "user-me" },
      { _id: "pet-2", name: "Sky", photos: [PHOTOS.sky], owner: "user-2" },
    ],
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Friendships, as `/api/friends` returns them: Friend rows with both owners
 * and both pets. `pet1`/`pet2` line up with `user1`/`user2`, which is what
 * lets the list show the pal your pet actually made friends with rather than
 * whichever animal happened to be first in that household.
 */
export const FRIENDS = [
  {
    _id: "friend-1",
    status: true,
    user1: { _id: "user-me", username: "sam", userPhoto: PHOTOS.me },
    user2: { _id: "user-1", username: "maya", userPhoto: PHOTOS.me },
    pet1: { _id: "pet-mine", name: "Rex", breed: "Beagle", photos: [PHOTOS.me] },
    pet2: { _id: "pet-1", name: "Bo", breed: "Border Collie", photos: [PHOTOS.bo] },
  },
  {
    _id: "friend-2",
    status: true,
    // The other way round, so the list is exercised from both sides of the
    // pair - `pairFor` sorts the owners, so either can be `user1`.
    user1: { _id: "user-2", username: "dev", userPhoto: PHOTOS.me },
    user2: { _id: "user-me", username: "sam", userPhoto: PHOTOS.me },
    pet1: { _id: "pet-2", name: "Sky", breed: "Whippet", photos: [PHOTOS.sky] },
    pet2: { _id: "pet-mine", name: "Rex", breed: "Beagle", photos: [PHOTOS.me] },
  },
];

/** Pending pal requests: one you received, one you sent. */
export const FRIEND_REQUESTS = [
  {
    _id: "req-1",
    status: "pending",
    createdDate: new Date().toISOString(),
    sender: { _id: "user-1", username: "maya" },
    receiver: { _id: "user-me", username: "sam" },
    senderPet: { _id: "pet-1", name: "Bo", photos: [PHOTOS.bo] },
    receiverPet: { _id: "pet-mine", name: "Rex", photos: [PHOTOS.me] },
  },
  {
    _id: "req-2",
    status: "pending",
    createdDate: new Date(Date.now() - 86400000).toISOString(),
    sender: { _id: "user-me", username: "sam" },
    receiver: { _id: "user-2", username: "dev" },
    senderPet: { _id: "pet-mine", name: "Rex", photos: [PHOTOS.me] },
    receiverPet: { _id: "pet-2", name: "Sky", photos: [PHOTOS.sky] },
  },
];

export const BLOCKED = [
  { _id: "block-1", blockedUser: { _id: "user-9", username: "nuisance" } },
];

export const ARTICLE = {
  _id: "article-1",
  slug: "six-games-for-a-herding-dog",
  title: "Six games that tire a herding dog out",
  byline: "PetPals Connect",
  summary:
    "Herding breeds need a job more than they need a longer walk. These six " +
    "give them one, and most of them fit in a back garden.",
  content:
    "If you have a Border Collie, an Australian Shepherd, a Kelpie or a " +
    "Malinois, you have probably discovered the central problem: physical " +
    "exercise makes them fitter, not tireder.\n\n" +
    "One. Hide and seek with a person.\n\n" +
    "Have someone hold the dog. Go and hide. Call once. Let the dog find " +
    "you, and make a genuine fuss when they do. It uses scent and " +
    "problem-solving, and it doubles as recall practice.\n\n" +
    "Two. Scatter feeding and the sniffari.\n\n" +
    "Stop using a bowl. Throw the meal across rough grass and let them hunt. " +
    "A meal that took eleven seconds now takes fifteen minutes of work.",
  // Long enough to prove the source list wraps and the tap targets clear the
  // 44pt floor, which is the only reason this board exists.
  sources: [
    {
      title: "Let me sniff! Nosework induces positive judgment bias in pet dogs",
      publisher: "Applied Animal Behaviour Science",
      url: "https://psychology.barnard.edu/sites/default/files/inline-files/Let%20me%20sniff.pdf",
    },
    {
      title: "Guidelines for exercising pups: separating myths from science",
      publisher: "Veterinary Ireland Journal",
      url: "https://www.veterinaryirelandjournal.com/small-animal/392-guidelines-for-exercising-pups-separating-myths-from-science",
    },
  ],
  tags: ["dogs", "enrichment", "play", "breeds"],
  publishedDate: new Date().toISOString(),
  lastReviewedDate: new Date().toISOString(),
};

/**
 * The browse index. Counts are what makes the row an index rather than a set
 * of buttons, and the species tags lead because "do you have a cat or a
 * rabbit" is the first cut a reader makes.
 */
export const TOPICS = [
  { tag: "dogs", count: 34 },
  { tag: "cats", count: 14 },
  { tag: "rabbits", count: 3 },
  { tag: "birds", count: 3 },
  { tag: "reptiles", count: 3 },
  { tag: "health", count: 24 },
  { tag: "behaviour", count: 21 },
  { tag: "safety", count: 16 },
  { tag: "playdates", count: 12 },
];

/** The list screen. Deliberately mixed: one with an image, one without. */
export const ARTICLES = [
  ARTICLE,
  {
    _id: "article-2",
    slug: "playdates-in-the-heat",
    title: "Playdates in the heat: the seven-second test",
    byline: "PetPals Connect",
    summary:
      "At 87F air temperature asphalt can hit 143F, and flat-faced dogs had " +
      "over four times the odds of heat-related illness in a 2024 study.",
    content: "This is the article to read before an August playdate.",
    publishedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    _id: "article-3",
    slug: "microchips-and-registration",
    title: "A microchip only works if the registration does",
    byline: "PetPals Connect",
    summary:
      "Microchipped dogs went home 52.2% of the time against 21.9% unchipped; " +
      "for cats it was 38.5% against 1.8%.",
    content: "Save ten minutes today and check the registry.",
    publishedDate: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

/**
 * A request that never resolves, for photographing a loading state.
 *
 * The skeletons are one of the things most worth seeing, and they are on screen
 * for a few hundred milliseconds in real life - too short to catch and too
 * timing-dependent to catch reliably.
 */
export const pending = Symbol("pending");

/**
 * What each endpoint answers with.
 *
 * Keyed by path prefix, matched longest-first, so `/api/pets/latest` wins over
 * `/api/pets`.
 */
/**
 * A notifications list with each kind in it, unread and read.
 *
 * The point of looking at this one is the icon column and the unread weight:
 * every row used to be the same line of grey text with a three-dot menu.
 */
const hoursAgo = (hours) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const NOTIFICATIONS = [
  {
    _id: "notif-1",
    type: "petMatch",
    content: "Bo liked Ada back - you matched!",
    petId: "pet-2",
    readStatus: false,
    timestamp: hoursAgo(0.2),
  },
  {
    _id: "notif-2",
    type: "message",
    content: "sam sent you a message.",
    chatId: "chat-1",
    readStatus: false,
    timestamp: hoursAgo(2),
  },
  {
    _id: "notif-3",
    type: "playdate",
    content: "Ada wants a playdate with Bo.",
    playdateId: "playdate-1",
    readStatus: false,
    timestamp: hoursAgo(20),
  },
  {
    _id: "notif-4",
    type: "friendRequest",
    content: "Rex wants to be friends with Ada!",
    requesterId: "user-3",
    readStatus: true,
    timestamp: hoursAgo(50),
  },
  {
    _id: "notif-5",
    type: "reviewReminder",
    content: "How was your playdate? Leave a review.",
    playdateId: "playdate-0",
    readStatus: true,
    timestamp: hoursAgo(96),
  },
];

/**
 * The care hub's two halves.
 *
 * A dog and a cat, because one pet hides the pet picker and the whole point of
 * the hub is that a profile can hold more than one kind of animal. The cat
 * carries a `seeAVet` flag, which is the state worth looking at: an owner who
 * noted something about their pet's health gets their vets rather than a
 * product, and that callout has to read as care rather than as an error.
 */
export const CARE_PICKS = {
  categories: ["food", "supplies", "enrichment", "grooming", "health"],
  placeCategories: ["vet", "petStore", "groomer", "boarding"],
  emergency: [
    {
      id: "aspca-apcc",
      name: "ASPCA Animal Poison Control Center",
      phone: "888-426-4435",
      region: "US",
      note: "24/7. A consultation fee may apply.",
    },
    {
      id: "pet-poison-helpline",
      name: "Pet Poison Helpline",
      phone: "855-764-7661",
      region: "US and Canada",
      note: "24/7. A consultation fee may apply.",
    },
  ],
  pets: [
    {
      petId: "pet-1",
      name: "Bo",
      species: "dog",
      stage: "adult",
      size: "medium",
      seeAVet: false,
      shelves: [
        {
          category: "food",
          picks: [
            {
              id: "dog-adult-food",
              category: "food",
              title: "Adult dog food",
              why: "Formulated for a dog that has finished growing.",
              url: "https://example.test/1",
            },
          ],
        },
        {
          category: "supplies",
          picks: [
            {
              id: "dog-harness-large",
              category: "supplies",
              title: "No-pull harness",
              why: "A front clip gives you steering on a dog strong enough to need it.",
              url: "https://example.test/2",
            },
            {
              id: "dog-crate",
              category: "supplies",
              title: "Crate",
              why: "Sized so they can stand up and turn around - measure before buying.",
              url: "https://example.test/3",
            },
          ],
        },
      ],
    },
    {
      petId: "pet-2",
      name: "Mog",
      species: "cat",
      stage: "senior",
      size: "small",
      seeAVet: true,
      shelves: [
        {
          category: "food",
          picks: [
            {
              id: "cat-senior-food",
              category: "food",
              title: "Senior cat food",
              why: "Easier to chew and gentler on ageing kidneys.",
              url: "https://example.test/4",
            },
          ],
        },
      ],
    },
  ],
};

export const CARE_PLACES = {
  locationKnown: true,
  importable: true,
  emergency: [],
  // A saved place, because the pinned section above the search is the part of
  // this screen that has to read as "yours" rather than as another result.
  saved: [
    {
      _id: "loc-saved",
      name: "Dr Okafor - Family Veterinary",
      address: "310 Bryant Street",
      categories: ["vet"],
      distanceMiles: 2.2,
    },
  ],
  places: [
    {
      _id: "loc-1",
      name: "Averill Veterinary Clinic",
      address: "1200 Averill Street",
      categories: ["vet"],
      distanceMiles: 0.8,
    },
    {
      _id: "loc-2",
      name: "Bay Pet Supply",
      address: "44 Harrison Avenue",
      categories: ["petStore", "groomer"],
      distanceMiles: 1.4,
    },
    {
      _id: "loc-3",
      name: "Sunset Boarding Kennels",
      address: "9 Sunset Way",
      categories: ["boarding"],
      distanceMiles: 3.1,
    },
  ],
};

/**
 * Account settings, as `GET /api/users/me/settings` answers them.
 *
 * `choices` travels with the values because the screens build their pickers
 * from it rather than repeating the option lists - so a board that dropped it
 * would render an empty segmented control and look like a bug in the design
 * rather than a gap in the fixture.
 */
export const SETTINGS = {
  playdateRange: 25,
  locationSharingEnabled: true,
  notificationsEnabled: true,
  units: { distance: "mi", weight: "lb" },
  discovery: {
    minWeight: 10,
    maxWeight: 80,
    minAge: 0,
    maxAge: 30,
    species: ["dog"],
    includeUnknownDistance: true,
  },
  privacy: {
    profileVisibility: "everyone",
    messagesFrom: "matches",
    friendRequestsFrom: "everyone",
    discoverableInSearch: true,
    showOnMap: true,
  },
  spot: { readChats: false },
  choices: {
    units: { distance: ["mi", "km"], weight: ["lb", "kg"] },
    audiences: ["everyone", "matches", "friends"],
    requestAudiences: ["everyone", "friendsOfFriends", "nobody"],
    species: ["dog", "cat", "rabbit", "bird", "other"],
  },

};

/** Rex's vaccination records: two of three core vaccines, one with a certificate. */
export const HEALTH = {
  status: "partial",
  kinds: ["rabies", "dhpp", "bordetella", "influenza", "leptospirosis", "other"],
  coreKinds: ["rabies", "dhpp", "bordetella"],
  records: [
    {
      _id: "rec-1",
      pet: MY_PET._id,
      kind: "rabies",
      administeredAt: "2026-03-14T00:00:00.000Z",
      expiresAt: "2029-03-14T00:00:00.000Z",
      verification: "documented",
      certificatePhoto: PHOTOS.rex,
    },
    {
      _id: "rec-2",
      pet: MY_PET._id,
      kind: "dhpp",
      administeredAt: "2026-03-14T00:00:00.000Z",
      expiresAt: "2027-03-14T00:00:00.000Z",
      verification: "selfReported",
    },
  ],
};

/**
 * The poison lookup shows real entries rather than invented ones: the whole
 * point of the board is to check that a long, dense, source-cited card is
 * still readable on a phone in both themes.
 */
export const TOXINS = {
  severities: ["emergency", "call", "avoid"],
  contacts: CARE_PICKS.emergency,
  toxins: [
    {
      slug: "grapes-raisins",
      name: "Grapes, raisins and currants",
      aliases: ["grape", "raisin", "sultana"],
      species: ["dog"],
      severity: "emergency",
      signs: "Vomiting, lethargy, loss of appetite, and later a drop in how much the dog urinates.",
      guidance:
        "Grapes and their dried forms can cause sudden kidney failure in dogs. The reaction is unpredictable: severity does not track neatly with how much was eaten. Because the amount does not tell you what will happen, published guidance is to treat any ingestion as urgent.",
      sources: [
        {
          name: "ASPCA Animal Poison Control Center",
          url: "https://www.aspca.org/pet-care/animal-poison-control",
          year: 2025,
        },
      ],
    },
    {
      slug: "lilies",
      name: "Lilies",
      aliases: ["lily", "easter lily", "stargazer"],
      species: ["cat"],
      severity: "emergency",
      signs: "Vomiting, loss of appetite and lethargy first, then increased drinking and urinating.",
      guidance:
        "True lilies are the single most dangerous common houseplant for cats, and every part counts: petals, leaves, pollen and even the water in the vase.",
      sources: [
        {
          name: "FDA Center for Veterinary Medicine",
          url: "https://www.fda.gov/animal-veterinary",
          year: 2024,
        },
      ],
    },
    {
      slug: "chocolate",
      name: "Chocolate",
      aliases: ["cocoa", "cacao", "brownie"],
      species: ["dog", "cat"],
      severity: "call",
      signs: "Vomiting, diarrhoea, restlessness, a fast or irregular heartbeat, tremors.",
      guidance:
        "Darker and more bitter products are the more concentrated ones. How serious an amount is depends on the type and the size of the animal, which is the judgement the helpline is there to make.",
      sources: [
        {
          name: "ASPCA Animal Poison Control Center",
          url: "https://www.aspca.org/pet-care/animal-poison-control",
          year: 2025,
        },
      ],
    },
    {
      slug: "silica-gel",
      name: "Silica gel packets",
      aliases: ["silica gel", "desiccant"],
      species: ["dog", "cat"],
      severity: "avoid",
      signs: "Usually nothing. Occasionally mild vomiting.",
      guidance:
        "Included because it frightens people more than it should. The beads are not absorbed and pass through; the printed warning is about children choking rather than poisoning.",
      sources: [
        {
          name: "Pet Poison Helpline",
          url: "https://www.petpoisonhelpline.com",
          year: 2025,
        },
      ],
    },
  ],
};

/** The shop as the server lists it: one variant deliberately unpriced. */
export const STORE_CATALOGUE = {
  configured: true,
  categories: [
    { key: "tracking", label: "Tracking" },
    { key: "pets", label: "For your dog" },
    { key: "people", label: "For you" },
  ],
  products: [
    {
      id: "tracking-collar",
      category: "tracking",
      name: "PetPals Tracking Collar",
      description:
        "A PetPals collar with a GPS tracker built in. See where the collar last reported on the map, and share that with friends in the app for as long as you choose.",
      photos: [],
      requiresDeviceSetup: true,
      variants: [
        { sku: "collar-tracker-s", label: "Small (10–14 in)", price: { amount: 12900, currency: "usd" } },
        { sku: "collar-tracker-m", label: "Medium (14–18 in)", price: { amount: 12900, currency: "usd" } },
        { sku: "collar-tracker-l", label: "Large (18–24 in)", price: { amount: 12900, currency: "usd" } },
      ],
    },
    {
      id: "bandana",
      category: "pets",
      name: "PetPals Bandana",
      description: "A cotton bandana with the PetPals paw, in three sizes.",
      photos: [],
      variants: [
        { sku: "bandana-s", label: "Small", price: { amount: 1800, currency: "usd" } },
        { sku: "bandana-m", label: "Medium", price: { amount: 1800, currency: "usd" } },
        { sku: "bandana-l", label: "Large", price: null },
      ],
    },
    {
      id: "tee",
      category: "people",
      name: "PetPals Tee",
      description: "A soft cotton tee with the PetPals paw on the chest.",
      photos: [],
      variants: [
        { sku: "tee-s", label: "S", price: { amount: 2800, currency: "usd" } },
        { sku: "tee-m", label: "M", price: { amount: 2800, currency: "usd" } },
        { sku: "tee-l", label: "L", price: { amount: 2800, currency: "usd" } },
      ],
    },
  ],
};

export const ORDERS = [
  {
    _id: "ord-1",
    user: "me",
    status: "fulfilled",
    stripeSessionId: "cs_1",
    items: [
      { sku: "collar-tracker-m", productId: "tracking-collar", name: "PetPals Tracking Collar", variantLabel: "Medium (14–18 in)", quantity: 1, unitAmount: 12900, currency: "usd" },
      { sku: "tee-m", productId: "tee", name: "PetPals Tee", variantLabel: "M", quantity: 2, unitAmount: 2800, currency: "usd" },
    ],
    amountSubtotal: 18500,
    amountTax: 1590,
    amountShipping: 0,
    amountTotal: 20090,
    amountRefunded: 0,
    currency: "usd",
    shipping: { name: "Sam Rivera", line1: "2400 E Camelback Rd", city: "Phoenix", state: "AZ", postalCode: "85016", country: "US" },
    email: "sam@example.test",
    carrier: "USPS",
    trackingNumber: "9400 1000 0000 0000 0000 00",
    createdDate: "2026-09-02T17:20:00.000Z",
    modifiedDate: "2026-09-04T09:00:00.000Z",
  },
  {
    _id: "ord-2",
    user: "me",
    status: "paid",
    items: [{ sku: "bandana-m", productId: "bandana", name: "PetPals Bandana", variantLabel: "Medium", quantity: 1, unitAmount: 1800, currency: "usd" }],
    amountSubtotal: 1800,
    amountTax: 155,
    amountShipping: 0,
    amountTotal: 1955,
    amountRefunded: 0,
    currency: "usd",
    createdDate: "2026-09-09T12:00:00.000Z",
    modifiedDate: "2026-09-09T12:00:00.000Z",
  },
];

/** A collar reporting a few minutes ago, and its last hour of movement. */
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

export const TRACKING_POSITIONS = {
  pet: { _id: MY_PET._id, name: MY_PET.name, photos: MY_PET.photos },
  owner: { _id: "me", username: "sam" },
  device: {
    _id: "dev-1",
    serial: "PPC-000451",
    vendor: "generic",
    status: "active",
    batteryPercent: 68,
    lastSeenAt: minutesAgo(3),
    latest: null,
  },
  latest: { latitude: 33.4512, longitude: -112.0733, accuracyMeters: 7, batteryPercent: 68, recordedAt: minutesAgo(3) },
  trail: [
    { latitude: 33.4498, longitude: -112.0761, accuracyMeters: 9, batteryPercent: 69, recordedAt: minutesAgo(48) },
    { latitude: 33.4503, longitude: -112.0752, accuracyMeters: 8, batteryPercent: 69, recordedAt: minutesAgo(31) },
    { latitude: 33.4509, longitude: -112.0741, accuracyMeters: 8, batteryPercent: 68, recordedAt: minutesAgo(17) },
    { latitude: 33.4512, longitude: -112.0733, accuracyMeters: 7, batteryPercent: 68, recordedAt: minutesAgo(3) },
  ],
  serverTime: new Date().toISOString(),
};

export const TRACKING_SHARES = {
  given: [
    {
      _id: "share-1",
      pet: { _id: MY_PET._id, name: MY_PET.name },
      owner: "me",
      viewer: { _id: "u-alex", username: "alex" },
      expiresAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
      createdDate: minutesAgo(40),
    },
  ],
  received: [],
};

export const TRACKED_COLLARS = {
  collars: [
    {
      pet: { _id: MY_PET._id, name: MY_PET.name, photos: MY_PET.photos },
      owner: { _id: "me", username: "sam" },
      mine: true,
      batteryPercent: 68,
      lastSeenAt: minutesAgo(3),
      latest: { latitude: 37.7902, longitude: -122.4331, accuracyMeters: 7, batteryPercent: 68, recordedAt: minutesAgo(3) },
    },
    {
      pet: { _id: "pet-9", name: "Sky", photos: [PHOTOS.sky] },
      owner: { _id: "u-alex", username: "alex" },
      mine: false,
      batteryPercent: 41,
      lastSeenAt: minutesAgo(26),
      // Quiet for a while: drawn faint on the map.
      latest: { latitude: 37.7861, longitude: -122.4268, accuracyMeters: 12, batteryPercent: 41, recordedAt: minutesAgo(26) },
    },
  ],
  serverTime: new Date().toISOString(),
};

/** A pal's collar, shared with the viewer: the same shape, somebody else's dog. */
export const SHARED_POSITIONS = {
  ...TRACKING_POSITIONS,
  pet: { _id: "pet-9", name: "Sky", photos: [PHOTOS.sky] },
  owner: { _id: "u-alex", username: "alex" },
  device: { ...TRACKING_POSITIONS.device, _id: "dev-9", serial: "PPC-000982", batteryPercent: 41 },
};

/**
 * Spot, on and agreed to, with a conversation that shows all three blocks:
 * a chip row, a "Spot did this" card with its undo, and the helpline numbers
 * after a toxin question. The text is the shape a real answer takes - plain
 * paragraphs, the vet at the end - because the gallery is the one place the
 * reading column can be judged.
 */
/**
 * A conversation with the phase 4 blocks: a done card with no undo (the
 * organiser has been told) and the retailer searches from the picks table.
 */
export const SPOT_ACTIONS = {
  _id: "conv-3",
  title: "accept the playdate from alex",
  createdAt: new Date(Date.now() - 7200e3).toISOString(),
  updatedAt: new Date(Date.now() - 600e3).toISOString(),
  messages: [
    {
      _id: "sa-1",
      role: "user",
      text: "accept the playdate from alex on saturday",
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 7000e3).toISOString(),
    },
    {
      _id: "sa-2",
      role: "assistant",
      text: "Done. Saturday at Dolores Park is on, and alex has been told.",
      blocks: [
        {
          type: "done",
          kind: "respondToPlaydate",
          summary: "Accepted the playdate on 2026-10-03; @alex has been told",
          undo: null,
        },
        { type: "links", items: [{ screen: "PlaydateDetails", params: { playdateId: "pd-1" }, label: "Open playdate" }] },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 6900e3).toISOString(),
    },
    {
      _id: "sa-3",
      role: "user",
      text: `what food should I be buying for ${MY_PET.name}?`,
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 700e3).toISOString(),
    },
    {
      _id: "sa-4",
      role: "assistant",
      text: `For an adult, medium dog the care hub suggests these categories. They are kinds of thing to look for, not brands, and the reason sits beside each one on the hub. Your vet is the one to ask about amounts.`,
      blocks: [
        {
          type: "web",
          items: [
            { label: "Adult dog food", url: "https://www.google.com/search?q=adult+dog+food" },
            { label: "Slow feeder bowl", url: "https://www.google.com/search?q=slow+feeder+bowl" },
            { label: "Medium dog harness", url: "https://www.google.com/search?q=medium+dog+harness" },
          ],
        },
        { type: "links", items: [{ screen: "Shop", params: {}, label: "Shop" }] },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 600e3).toISOString(),
    },
  ],
};

export const SPOT_NOTES = [
  { _id: "n-1", text: `${MY_PET.name} is scared of thunderstorms`, createdAt: new Date(Date.now() - 86400e3 * 3).toISOString() },
  { _id: "n-2", text: "We use the vet on 7th Street", createdAt: new Date(Date.now() - 86400e3).toISOString() },
];

export const SPOT_STATUS = {
  enabled: true,
  consented: true,
  readChats: false,
  voice: false,
  quota: { used: 2, limit: 3, premium: false },
};

/** What Spot noticed, for the Home card. */
export const SPOT_NOTICED = [
  {
    id: `vaccine-${MY_PET._id}`,
    kind: "vaccine",
    text: `One of ${MY_PET.name}'s vaccinations is due within 30 days.`,
    question: `Is ${MY_PET.name} due for anything?`,
    screen: "PetHealth",
    params: { petId: MY_PET._id },
  },
  {
    id: `weight-${MY_PET._id}`,
    kind: "weight",
    text: `${MY_PET.name} hasn't been weighed in 4 months.`,
    question: `Log a weigh-in for ${MY_PET.name}`,
    screen: "PetWeight",
    params: { petId: MY_PET._id },
  },
];

/** A conversation whose answers carry cards: articles, then pals. */
export const SPOT_CARDS = {
  _id: "conv-4",
  title: "what should I know about kennel cough",
  createdAt: new Date(Date.now() - 900e3).toISOString(),
  updatedAt: new Date(Date.now() - 800e3).toISOString(),
  messages: [
    {
      _id: "sc-1",
      role: "user",
      text: "what should I know about kennel cough?",
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 900e3).toISOString(),
    },
    {
      _id: "sc-2",
      role: "assistant",
      text: "Two of PetPals' articles cover it: one on what Bordetella is and is not, one on the vaccine daycares ask for. The short version is that it is usually mild and passes in a couple of weeks, and your vet is the call if the cough lasts or your dog goes off food.",
      blocks: [
        {
          type: "cards",
          items: [
            { title: "Kennel cough, plainly", subtitle: "What Bordetella is and is not, and why daycares ask.", image: null, chip: { screen: "ArticleDetail", params: { articleId: "art-1" }, label: "Read" } },
            { title: "The Bordetella vaccine", subtitle: "Core for the individual once a dog is in regular group contact.", image: null, chip: { screen: "ArticleDetail", params: { articleId: "art-2" }, label: "Read" } },
          ],
        },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 890e3).toISOString(),
    },
    {
      _id: "sc-3",
      role: "user",
      text: "who could Bella meet this weekend?",
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 810e3).toISOString(),
    },
    {
      _id: "sc-4",
      role: "assistant",
      text: "Two pals are around. Tap one and I can fill in a playdate form for Saturday.",
      blocks: [
        {
          type: "cards",
          items: [
            { title: "Sky", subtitle: "Whippet · with @alex", image: "https://placedog.net/300/200?id=12", chip: { screen: "PetDetails", params: { petId: "pet-9" }, label: "Open Sky" } },
            { title: "Max", subtitle: "Labrador · with @sam", image: "https://placedog.net/300/200?id=7", chip: { screen: "PetDetails", params: { petId: "pet-7" }, label: "Open Max" } },
          ],
        },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 800e3).toISOString(),
    },
  ],
};

export const SPOT_CONVERSATION = {
  _id: "conv-1",
  title: "Bella has been scratching her ears",
  createdAt: new Date(Date.now() - 3600e3).toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      _id: "sm-1",
      role: "user",
      text: `${MY_PET.name} has been scratching her ears a lot this week`,
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 3500e3).toISOString(),
    },
    {
      _id: "sm-2",
      role: "assistant",
      text:
        `Ear scratching that goes on for a week is worth a look rather than a wait. Published guidance lists infection, mites, allergies and something lodged in the canal as the usual reasons, and none of them can be told apart from the outside.

What you can notice before the visit: whether one ear or both, any smell or discharge, head shaking, and whether it started after swimming. Those are the things your vet will ask.

Her records show rabies and DHPP in date and no Bordetella entered, if that comes up while you are there.`,
      blocks: [
        {
          type: "links",
          items: [
            { screen: "PetHealth", params: { petId: MY_PET._id }, label: "Health records" },
            { screen: "Map", params: {}, label: "Vets near you" },
          ],
        },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 3400e3).toISOString(),
    },
    {
      _id: "sm-3",
      role: "user",
      text: "she also weighed 44 today, log that",
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 1800e3).toISOString(),
    },
    {
      _id: "sm-4",
      role: "assistant",
      text: `Logged ${MY_PET.name} at 44 lb. That is two pounds up on March; the chart on her weight screen shows the trend, and your vet can say what it means for her.`,
      blocks: [
        {
          type: "done",
          kind: "logWeight",
          summary: `Logged ${MY_PET.name} at 44 lb`,
          undo: { kind: "removeWeight", petId: MY_PET._id, entryId: "w-4" },
        },
        { type: "links", items: [{ screen: "PetWeight", params: { petId: MY_PET._id }, label: "Weight history" }] },
      ],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 1700e3).toISOString(),
    },
    {
      _id: "sm-5",
      role: "user",
      text: "and she got into some raisin bread yesterday, is that bad?",
      blocks: [],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 600e3).toISOString(),
    },
    {
      _id: "sm-6",
      role: "assistant",
      text:
        `Raisins are in the poison table as an emergency for dogs: published guidance says not to wait for signs, because the kidney damage they can cause is not visible from the outside and the amount that matters varies from dog to dog.

Ring one of the numbers below now rather than watching her. They will want her weight, which is on record as 44 lb, and roughly when it happened.`,
      blocks: [{ type: "contacts", items: CARE_PICKS.emergency }],
      attachments: [],
      flagged: false,
      source: "model",
      createdAt: new Date(Date.now() - 500e3).toISOString(),
    },
  ],
};

export const ROUTES = {
  "/api/spot/status": SPOT_STATUS,
  "/api/spot/conversations/conv-1": SPOT_CONVERSATION,
  // The first exchange alone, so the opening of the reading column fits a viewport.
  "/api/spot/conversations/conv-2": { ...SPOT_CONVERSATION, _id: "conv-2", messages: SPOT_CONVERSATION.messages.slice(0, 2) },
  "/api/spot/conversations/conv-3": SPOT_ACTIONS,
  "/api/spot/conversations/conv-4": SPOT_CARDS,
  "/api/spot/noticed": SPOT_NOTICED,
  "/api/spot/conversations": [SPOT_ACTIONS, SPOT_CONVERSATION].map(({ messages, ...row }) => ({
    ...row,
    messageCount: messages.length,
  })),
  "/api/spot/notes": SPOT_NOTES,
  "/api/tracking/status": { enabled: true, vendor: "generic", acceptsIngest: true },
  [`/api/tracking/pets/${MY_PET._id}/positions`]: TRACKING_POSITIONS,
  "/api/tracking/pets/pet-9/positions": SHARED_POSITIONS,
  "/api/tracking/shares": TRACKING_SHARES,
  "/api/tracking/map": TRACKED_COLLARS,
  "/api/store/products": STORE_CATALOGUE,
  // Longest prefix first: an order by id must not be answered with the list.
  "/api/store/orders/ord-1": ORDERS[0],
  "/api/store/orders": ORDERS,
  [`/api/pets/${MY_PET._id}/health`]: HEALTH,
  "/api/petcare/toxins": TOXINS,
  [`/api/pets/${MY_PET._id}/weight`]: {
    measured: true,
    entries: [
      { _id: "w-3", pounds: 44, takenAt: new Date().toISOString(), bodyCondition: 7 },
      { _id: "w-2", pounds: 42, takenAt: new Date(Date.now() - 90 * 864e5).toISOString() },
      { _id: "w-1", pounds: 39, takenAt: new Date(Date.now() - 200 * 864e5).toISOString() },
    ],
  },
  "/api/petcare/lost-pet": {
    contacts: CARE_PICKS.emergency,
    identification: [
      { petId: MY_PET._id, petName: MY_PET.name, kind: "microchip", label: "985141000123456" },
    ],
    steps: [
      {
        id: "check-chip",
        title: "Check the microchip registration first",
        body:
          "A chip only works if the registry has a phone number that still reaches you. Look the number up in the registry's own database and confirm the details are current.",
        source: {
          name: "AAHA universal chip lookup",
          url: "https://www.aaha.org/petmicrochiplookup/",
        },
      },
      {
        id: "search-close",
        title: "Search close to home, and at night",
        body:
          "Most cats and many frightened dogs are found within a few houses of home, hiding rather than travelling. Go back after dark with a torch when it is quiet.",
        source: { name: "ASPCA, lost pet guidance", url: "https://www.aspca.org" },
      },
      {
        id: "call-shelters",
        title: "Ring and then visit the local shelters",
        body:
          "File a lost report with every shelter and animal control office in your area, and go in person where you can.",
        source: { name: "ASPCA, lost pet guidance", url: "https://www.aspca.org" },
      },
    ],
  },
  "/api/pets/pet-1/health/status": { status: "current", shared: true },
  "/api/petmatches/discover": {
    pet: MY_PET,
    preview: false,
    threshold: 45,
    range: 25,
    locationKnown: true,
    candidates: CANDIDATES,
  },
  "/api/pets/latest": [CANDIDATES[0].pet, CANDIDATES[1].pet, MY_PET],
  "/api/favorites": [{ _id: "fav-1", pet: CANDIDATES[0].pet }],
  "/api/articles/recent": ARTICLE,
  // Registered before the shorter article paths: the gallery's interceptor
  // matches longest-prefix-first, so "/api/articles/" must not swallow these.
  [`/api/articles/${ARTICLE._id}/related`]: ARTICLES.slice(1),
  "/api/articles/topics": TOPICS,
  "/api/articles/latest": ARTICLES,
  [`/api/articles/${ARTICLE._id}`]: ARTICLE,
  "/api/chats": CHATS,
  "/api/friends": FRIENDS,
  "/api/friendrequests": FRIEND_REQUESTS,
  "/api/blocklists": BLOCKED,
  "/api/reports/options": { reasons: [], targets: [] },
  "/api/petcare/picks": CARE_PICKS,
  "/api/locations/care": CARE_PLACES,
  "/api/petmatches/map": {
    origin: { latitude: 37.78825, longitude: -122.4324 },
    range: 25,
    pets: [
      {
        _id: "pet-1",
        name: "Bo",
        breed: "Beagle",
        photos: [PHOTOS.bo],
        latitude: 37.7925,
        longitude: -122.4382,
        distanceMiles: 0.6,
      },
      {
        _id: "pet-2",
        name: "Sky",
        breed: "Whippet",
        photos: [PHOTOS.sky],
        latitude: 37.7842,
        longitude: -122.4201,
        distanceMiles: 1.1,
      },
    ],
  },
  "/api/locations": [
    {
      _id: "loc-1",
      name: "Dolores Park",
      address: "19th St & Dolores St",
      geoLocation: { type: "Point", coordinates: [-122.4269, 37.7596] },
      distanceMiles: 1.9,
    },
    {
      _id: "loc-2",
      name: "Duboce Park",
      address: "Duboce Ave & Scott St",
      geoLocation: { type: "Point", coordinates: [-122.4353, 37.7692] },
      distanceMiles: 1.4,
    },
  ],
  "/api/notifications": NOTIFICATIONS,
  "/api/userpreferences/categories": {
    categories: [
      { key: "messages", label: "Messages" },
      { key: "matches", label: "New matches" },
      { key: "playdateReminders", label: "Playdates and reminders" },
      { key: "friendRequests", label: "Friend requests" },
      { key: "appUpdates", label: "Everything else" },
    ],
  },
  // Longer than "/api/locations", so the interceptor's longest-prefix match
  // picks this one for the scheduling screen.
  "/api/locations/playdate-locations": [
    {
      _id: "loc-1",
      name: "Dolores Park",
      address: "19th St & Dolores St",
      distanceMiles: 1.9,
    },
    {
      _id: "loc-2",
      name: "Duboce Park",
      address: "Duboce Ave & Scott St",
      distanceMiles: 1.4,
    },
  ],
  // PetMatch rows, which is what the endpoint really returns - the pet is on
  // `pet2`. Rendering the row as a pet is the bug the pet picker used to have.
  "/api/petmatches/matched-pets": [
    { _id: "match-1", matchScore: 82, pet1: MY_PET._id, pet2: CANDIDATES[0].pet },
    { _id: "match-2", matchScore: 61, pet1: MY_PET._id, pet2: CANDIDATES[1].pet },
  ],
  "/api/locations/loc-1": {
    _id: "loc-1",
    name: "Dolores Park",
    address: "19th St & Dolores St",
    rating: 4.6,
  },
  "/api/userpreferences/me": {
    notificationPreferences: {
      pushNotificationsEnabled: true,
      emailNotificationsEnabled: false,
      messages: true,
      matches: true,
      playdateReminders: false,
      friendRequests: true,
      appUpdates: true,
    },
    quietHours: {
      enabled: true,
      start: "22:00",
      end: "07:00",
      utcOffsetMinutes: 0,
    },
  },
  "/api/users/me/settings": SETTINGS,
};

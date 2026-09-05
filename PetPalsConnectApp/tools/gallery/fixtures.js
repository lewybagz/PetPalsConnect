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

export const CHATS = [
  {
    _id: "chat-1",
    participants: [{ _id: "user-1", username: "maya", userPhoto: PHOTOS.me }],
    lastMessage: { contentText: "Bo would love that! Saturday morning?" },
    petId: { _id: "pet-1", name: "Bo", photos: [PHOTOS.bo] },
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "chat-2",
    participants: [{ _id: "user-2", username: "dev", userPhoto: PHOTOS.me }],
    lastMessage: { contentText: "Sky is a bit shy around bigger dogs" },
    petId: { _id: "pet-2", name: "Sky", photos: [PHOTOS.sky] },
    updatedAt: new Date().toISOString(),
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
  tags: ["dogs", "enrichment", "play"],
  publishedDate: new Date().toISOString(),
  lastReviewedDate: new Date().toISOString(),
};

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

export const ROUTES = {
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
  "/api/articles/latest": ARTICLES,
  "/api/chats": CHATS,
  "/api/blocklists": BLOCKED,
  "/api/reports/options": { reasons: [], targets: [] },
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
  },
};

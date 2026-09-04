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
  title: "Six games that tire a collie out",
  content:
    "Herding breeds need a job more than they need a long walk. These six " +
    "games give them one, and most of them fit in a back garden.",
  publishedDate: new Date().toISOString(),
};

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
  "/api/articles/latest": ARTICLE,
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
};

/**
 * The shapes the API actually returns.
 *
 * Hand-written against the Mongoose schemas in `backend/models`: the backend
 * has no OpenAPI document, and the thing that keeps the two halves honest is
 * the contract suite. `backend/test/contract.test.js` reads this file and
 * checks every field below against the real schema, so a name that drifts on
 * either side fails the build rather than rendering blank on a device.
 *
 * That check earns its keep immediately: the first draft of this file invented
 * `fullName`, `bio`, `profilePhotoUrl`, `gender` and `photoUrl` from memory,
 * and not one of them exists. Which is the same bug the subscription screens
 * shipped with for four sessions - reading `subscription.PlanType` off a
 * document whose field is `planType`.
 *
 * Rules: every field must exist on the schema, and a field the schema does not
 * mark required is optional here. A type that claims more than the server
 * guarantees is worse than no type at all.
 */

/** Mongo ids arrive as strings over JSON. */
export type ObjectId = string;

/** Dates arrive as ISO strings, not `Date`s. */
export type IsoDate = string;

/**
 * The kinds of animal a profile can hold.
 *
 * Only `"dog"` can be matched - playdates are dogs meeting dogs, and the deck
 * filters to it. The rest exist so the care hub has something to recommend
 * food, supplies and a vet from. Mirrors the `SPECIES` enum on the schema.
 */
export type PetSpecies =
  | "dog"
  | "cat"
  | "smallMammal"
  | "bird"
  | "reptile"
  | "fish";

export interface Pet {
  _id: ObjectId;
  name: string;
  /**
   * Optional because it is only stored for pets that have one in any useful
   * sense. A pet from before the field existed has none, and reads as a dog.
   */
  species?: PetSpecies;
  /**
   * Required by the schema for dogs and cats only - matching compares size and
   * portions are sized from it. A bird or a fish has no weight recorded, so
   * this is not guaranteed to be present.
   */
  weight?: number;
  /** Derived from `name` by a hook - `Pet` is a discriminator of `Content`. */
  title?: string;
  breed?: string;
  age?: number;
  /** A single value, not a list. */
  temperament?: string;
  activityLevel?: string;
  socialisation?: string;
  specialNeeds?: string;
  favoriteActivities?: string[];
  photos?: string[];
  owner?: ObjectId;
  playdates?: ObjectId[];
  createdAt?: IsoDate;
}

/**
 * What kind of place a `Location` is.
 *
 * `park` is where a playdate happens; the rest are the care hub. A place can
 * be several - plenty of vets board, plenty of shops groom - so `categories`
 * is a list. Mirrors the enum on the schema.
 */
export type PlaceCategory = "park" | "vet" | "petStore" | "groomer" | "boarding";

/**
 * A place: a park to meet at, or somewhere to take a pet for care.
 *
 * There is one model for both. There used to be two - `Location` and a
 * `Service` stub with a String address and no coordinates - and the importer
 * had been pulling vets and pet shops into `Location` the whole time, so the
 * directory existed in the model with the geo index while the other one sat
 * unused. `Service` is gone.
 *
 * `categories` is optional because rows imported before the field existed have
 * none, and a filtered list deliberately leaves those out rather than guessing
 * at their kind. `phone`, `website` and `openingHours` are filled in lazily by
 * the server the first time somebody opens the place, so a list response has
 * them absent and a detail response has them - when Google is configured and
 * has an answer.
 */
export interface Location {
  _id: ObjectId;
  name: string;
  address: string;
  /** Google's id for the place; the collection is unique on it. */
  placeId?: string;
  categories?: PlaceCategory[];
  description?: string;
  photo?: string;
  rating?: number;
  phone?: string;
  website?: string;
  /** Google's weekday text, one string per day, rendered as given. */
  openingHours?: string[];
  detailsFetchedAt?: IsoDate;
  createdDate?: IsoDate;
  modifiedDate?: IsoDate;
}

/**
 * One thing worth buying, and why.
 *
 * Not a document - these come from a source-controlled table on the server
 * (`services/petCare/picks.js`), not a collection, so there is no model to
 * check this against and nothing writes one at runtime. Each is a *category*
 * of thing with a search link, not a named product with an affiliate tag: the
 * app is not paid to say any of it, and if that ever changes the fact belongs
 * on screen next to the link.
 */
export interface CarePick {
  id: string;
  category: string;
  title: string;
  /** Shown to the owner - a recommendation that cannot say why is an advert. */
  why: string;
  url: string;
}

/** One pet's picks, grouped into the hub's shelves. */
export interface CarePicksForPet {
  petId: ObjectId | null;
  name: string | null;
  species: PetSpecies;
  /** Null when the pet's age is unknown; stage-dependent picks are then left out. */
  stage: "young" | "adult" | "senior" | null;
  /** Only dogs and cats record a weight, so null for everything else. */
  size: "small" | "medium" | "large" | null;
  /**
   * The owner wrote something in `specialNeeds`.
   *
   * The hub shows the local vets rather than a product. Those notes are never
   * an input to a pick - "diabetic" is a conversation with a vet, not a
   * shopping problem, and answering it with a bag of food is not something
   * this app should do.
   */
  seeAVet: boolean;
  shelves: { category: string; picks: CarePick[] }[];
}

/** A number to call when something has gone wrong. */
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  /** These are North American services and the app never asks where you live. */
  region: string;
  note?: string;
  url?: string;
}

export interface User {
  _id: ObjectId;
  firebaseUid: string;
  username: string;
  email: string;
  /** Lowercased copy; uniqueness is enforced on this, not `username`. */
  usernameLower?: string;
  userPhoto?: string;
  verified?: boolean;
  /** Ids, or populated documents, depending on the endpoint. */
  pets?: (ObjectId | Pet)[];
  friendsList?: ObjectId[];
  favorites?: ObjectId[];
  location?: ObjectId;
  playdateRange?: string;
  notificationsEnabled?: boolean;
  locationSharingEnabled?: boolean;
  fcmToken?: string;
  subscribed?: boolean;
  stripeCustomerId?: string;
  /**
   * Hidden pending review. The session gate reads this and renders the
   * suspended tree; the API refuses a suspended account nearly every route.
   * `suspendedReason` is a moderator's note and is deliberately not returned.
   */
  suspended?: boolean;
  suspendedAt?: IsoDate;
  createdDate?: IsoDate;
  modifiedDate?: IsoDate;
}

/** Stripe's own subscription statuses; our records mirror them exactly. */
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export interface Subscription {
  _id: ObjectId;
  user: ObjectId;
  status: SubscriptionStatus;
  /** Stripe's billing interval, so "month" or "year". */
  planType: string;
  /** Major units (9.99), not cents - the server divides on the way in. */
  amount?: number;
  currency?: string;
  cancelAtPeriodEnd?: boolean;
  startDate?: IsoDate;
  endDate?: IsoDate;
  createdDate?: IsoDate;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  stripePriceId?: string;
}

/**
 * A plan as the server offers it (`services/subscriptions/plans.js`). Not a
 * Mongo document, so the schema check does not apply to it. Prices live in
 * Stripe; the app never sends an amount.
 */
export interface Plan {
  id: string;
  name: string;
  description: string;
  interval: "month" | "year";
  /** False when no Stripe price id is configured for it. */
  available: boolean;
}

/** What `POST /api/subscriptions` hands back for Stripe's PaymentSheet. */
export interface PaymentSheetSession {
  subscriptionId: string;
  clientSecret: string | null;
  ephemeralKey: string;
  customerId: string;
}

/**
 * The onboarding gate's states, in the order a new account passes through
 * them. `ready` does NOT imply a pet exists - the add-a-pet step is skippable.
 */
export type SessionState =
  | "loading"
  | "signedOut"
  | "needsProfile"
  | "needsPet"
  | "suspended"
  | "ready"
  | "error";

/** The API's error body. Controllers return a user-facing `message` on 4xx. */
export interface ApiErrorBody {
  message: string;
  /**
   * A stable machine-readable reason, where the client has to act on the
   * difference rather than just show the message. `ACCOUNT_SUSPENDED` and
   * `SESSION_REVOKED` both change the whole navigation tree; `INVALID_TOKEN`
   * is a refresh-and-retry.
   */
  code?: string;
}

/**
 * A citation on an article.
 *
 * Its own interface rather than an inline object because `backend/test/
 * types.test.js` parses interface bodies with a regex that stops at the first
 * closing brace - a nested shape here would silently drop every field after it
 * from the check, which is exactly the drift that check exists to catch.
 */
export interface ArticleSource {
  title: string;
  publisher: string;
  url: string;
}

/**
 * An editorial article: the Articles screen, its detail view, and the home
 * screen's one-article shelf.
 *
 * `author` and `creator` are optional because articles are editorial. Seeded
 * content is written by the publication and has no user account behind it; an
 * article posted through `POST /api/articles` has both, taken from the token.
 * The visible attribution is `byline`.
 */
export interface Article {
  _id: string;
  title: string;
  summary?: string;
  content: string;
  byline: string;
  imageUrl?: string;
  tags?: string[];
  sources?: ArticleSource[];
  slug?: string;
  author?: string;
  creator?: string;
  publishedDate: string;
  lastReviewedDate: string;
}

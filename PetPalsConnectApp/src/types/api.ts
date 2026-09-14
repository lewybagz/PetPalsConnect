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
 * A vaccine an owner can record. Mirrors `KINDS` in
 * `backend/services/vaccinations.js`; the three core ones are what a daycare
 * or boarder asks to see.
 */
export type VaccinationKind =
  | "rabies"
  | "dhpp"
  | "bordetella"
  | "influenza"
  | "leptospirosis"
  | "other";

/**
 * Everything a `HealthRecord` can be. The vaccines above, plus the things an
 * owner remembers by date: the monthly preventatives, a check-up, a medication
 * by name. Mirrors `KIND_CATEGORIES` in `backend/services/vaccinations.js`.
 */
export type HealthKind =
  | VaccinationKind
  | "fleaTick"
  | "heartworm"
  | "vetVisit"
  | "medication";

export type HealthCategory = "vaccine" | "prevention" | "visit" | "medication";

/**
 * How much a record has been checked.
 *
 * `selfReported` is what the owner typed; `documented` means a certificate
 * photo is attached; `verified` means a person checked it - and nothing writes
 * that yet. The UI must never show `documented` as though it were `verified`.
 */
export type VaccinationVerification = "selfReported" | "documented" | "verified";

/**
 * The derived answer to "is this pet current", from `statusOf()` on the server.
 * `unknown` is no records at all; `partial` is some core vaccines missing.
 */
export type VaccinationStatus =
  | "unknown"
  | "partial"
  | "expired"
  | "expiringSoon"
  | "current";

/** One vaccination, recorded by the owner. Only the owner ever receives these. */
export interface HealthRecord {
  _id: ObjectId;
  pet: ObjectId;
  owner: ObjectId;
  kind: HealthKind;
  administeredAt: IsoDate;
  /** When the next dose is due, from the certificate. Optional. */
  expiresAt?: IsoDate;
  verification: VaccinationVerification;
  certificatePhoto?: string;
  /** Days between doses, for the kinds that repeat. "Done" re-arms from it. */
  intervalDays?: number;
  /** A medication's name. There is no field for how much, on purpose. */
  label?: string;
  notes?: string;
  createdDate?: IsoDate;
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

/**
 * The pet-insurance comparison link, when a partner exists.
 *
 * Not a document - it comes from two env vars on the server, set together or
 * not at all. `partner` is what the card says it opens; a link that cannot
 * name its partner is refused at boot, so this is never half-filled.
 */
export interface InsuranceOffer {
  url: string;
  partner: string;
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
  /** Asked once at profile creation. Absent on profiles from before the field. */
  zip?: string;
  /** Derived from `zip` on the server: a state code, or "other". The launch fence reads this. */
  region?: string;
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

/**
 * What the store reports through RevenueCat, mapped by the webhook. `past_due`
 * is a billing issue inside the store's grace period - still entitled until
 * `endDate`.
 */
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

export interface Subscription {
  _id: ObjectId;
  user: ObjectId;
  status: SubscriptionStatus;
  /** "month" or "year", derived from the store product id. */
  planType: string;
  /** Major units (4.99) as RevenueCat reports them. */
  amount?: number;
  currency?: string;
  /** Auto-renew is off in the store; the entitlement lasts to `endDate`. */
  cancelAtPeriodEnd?: boolean;
  startDate?: IsoDate;
  endDate?: IsoDate;
  createdDate?: IsoDate;
  /** app_store, play_store, promotional... lowercased from RevenueCat. */
  store?: string;
  productId?: string;
  originalTransactionId?: string;
  environment?: string;
}

/**
 * An order's state as Stripe reports it, mapped by the webhook. `pending` is a
 * Checkout Session that completed without the payment settling yet; `failed`
 * is one whose deferred payment did not go through. Mirrors `STATUSES` on the
 * `Order` schema, and `backend/test/types.test.js` checks the two agree.
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "refunded"
  | "disputed"
  | "failed";

/**
 * One line of an order, snapshotted from Stripe's own line items at the time
 * of purchase - a catalogue edit afterwards does not rewrite it.
 */
export interface OrderItem {
  /** The Stripe Price lookup key, which is also the catalogue sku. */
  sku?: string;
  productId?: string;
  name: string;
  variantLabel?: string;
  quantity: number;
  /** Minor units (cents), as Stripe reports it. */
  unitAmount?: number;
  currency?: string;
  /** The tracking collar: the order screen offers the set-up step for it. */
  requiresDeviceSetup: boolean;
}

/** The address Stripe collected. The app never asks for one. */
export interface OrderShipping {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * A shop order. Written only by the Stripe webhook, so a row exists once
 * Stripe has told the server about it - never merely because the buyer came
 * back from Checkout.
 */
export interface Order {
  _id: ObjectId;
  user: ObjectId;
  status: OrderStatus;
  stripeSessionId?: string;
  paymentIntentId?: string;
  items: OrderItem[];
  /** All amounts are minor units (cents). */
  amountSubtotal?: number;
  amountTax?: number;
  amountShipping?: number;
  amountTotal?: number;
  amountRefunded: number;
  currency: string;
  shipping?: OrderShipping;
  email?: string;
  carrier?: string;
  trackingNumber?: string;
  fulfilledAt?: IsoDate;
  refundedAt?: IsoDate;
  livemode?: boolean;
  createdDate: IsoDate;
  modifiedDate: IsoDate;
}

/** A live Stripe price, or null when the sku has no Price in the dashboard. */
export interface StorePrice {
  /** Minor units (cents). */
  amount: number;
  currency: string;
}

export interface StoreVariant {
  sku: string;
  label: string;
  price: StorePrice | null;
}

/** A catalogue entry from `backend/services/store/products.js`. */
export interface StoreProduct {
  id: string;
  category: string;
  name: string;
  description: string;
  photos: string[];
  /** The tracking collar: claimed by serial once delivered. */
  requiresDeviceSetup?: boolean;
  variants: StoreVariant[];
}

/** A collar's state. `inactive` keeps the row and drops its reports. */
export type DeviceStatus = "active" | "inactive";

/**
 * A tracking collar as the owner sees it. The ingest secret's hash is on the
 * schema and never in a response, so it is not here.
 */
export interface Device {
  _id: ObjectId;
  owner: ObjectId;
  pet: ObjectId;
  serial: string;
  /** Which adapter in `backend/services/tracking/vendor/` it reports through. */
  vendor: string;
  status: DeviceStatus;
  batteryPercent?: number;
  lastSeenAt?: IsoDate;
  createdDate: IsoDate;
  modifiedDate: IsoDate;
}

/**
 * Where a collar was, with named fields rather than GeoJSON order - the
 * server converts, so no screen has to remember that the stored pair is
 * [longitude, latitude]. Not a document, so not checked against a schema.
 */
export interface TrackedPosition {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  batteryPercent: number | null;
  recordedAt: IsoDate;
}

/** `GET /api/tracking/devices` and the `device` on a positions response. */
export interface TrackedDevice extends Device {
  latest: TrackedPosition | null;
}

/** Somebody named on a share, populated. */
export interface ShareParty {
  _id: ObjectId;
  username?: string;
  userPhoto?: string;
}

/**
 * "This friend may see this pet's collar until `expiresAt`." Per pet, per
 * friend, always expiring; a block ends its effect before the date does.
 */
export interface TrackingShare {
  _id: ObjectId;
  pet: ObjectId | Pick<Pet, "_id" | "name" | "photos">;
  owner: ObjectId | ShareParty;
  viewer: ObjectId | ShareParty;
  expiresAt: IsoDate;
  createdDate: IsoDate;
}

/** One collar on the map: mine, or a friend's shared with me. */
export interface TrackedCollar {
  pet: Pick<Pet, "_id" | "name" | "photos">;
  owner: ShareParty;
  mine: boolean;
  batteryPercent: number | null;
  lastSeenAt: IsoDate | null;
  latest: TrackedPosition | null;
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
  | "waitlisted"
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

/**
 * A rich piece beside a Spot answer. `links` are chips that navigate; `done`
 * is a write Spot made, with its undo where one exists; `contacts` are the
 * helpline numbers. The server attaches them mechanically
 * (`backend/services/spot/blocks.js`), never the model.
 */
export type SpotBlock =
  | { type: "links"; items: { screen: string; params: Record<string, string>; label: string }[] }
  | { type: "done"; kind: string; summary: string; undo: { kind: string; [key: string]: unknown } | null }
  | { type: "contacts"; items: EmergencyContact[] }
  /** Retailer searches from the picks table, opened in the browser. */
  | { type: "web"; items: { label: string; url: string }[] };

/** What a model turn cost, on the answer it produced. Absent on software turns. */
export interface SpotUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  iterations: number;
  ms: number;
}

/**
 * One turn with Spot. `source` says whether the model answered or software
 * did, in Spot's voice; a software turn lives only on the device.
 */
export interface SpotMessage {
  _id: string;
  role: "user" | "assistant";
  text: string;
  blocks: SpotBlock[];
  attachments: { kind: "photo"; width?: number; height?: number }[];
  flagged: boolean;
  source: "model" | "software";
  usage?: SpotUsage | null;
  createdAt: IsoDate;
}

/** Something the owner asked Spot to remember, in their words. */
export interface SpotNote {
  _id: ObjectId;
  text: string;
  createdAt: IsoDate;
}

export interface SpotConversation {
  _id: ObjectId;
  title: string;
  messages: SpotMessage[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** Where today's quota stands. `null` when Spot is off. */
export interface SpotQuota {
  used: number;
  limit: number;
  premium: boolean;
}

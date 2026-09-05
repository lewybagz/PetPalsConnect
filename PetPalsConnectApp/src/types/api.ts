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

export interface Pet {
  _id: ObjectId;
  name: string;
  /** Required by the schema: matching compares size. */
  weight: number;
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

const Subscription = require("../../models/Subscription");
const User = require("../../models/User");

/**
 * RevenueCat is the source of truth for billing; Mongo mirrors it.
 *
 * The app buys through the store (StoreKit / Play Billing) and RevenueCat
 * validates the receipt, tracks renewals, refunds and grace periods, and posts
 * one webhook per lifecycle event. `syncFromEvent` is the only writer of
 * `Subscription` and the only thing that sets `user.subscribed`, which is what
 * the rest of the API reads.
 *
 * This replaced Stripe. A subscription that unlocks in-app content has to go
 * through native IAP - Apple 3.1.1 and Play's payments policy both say so -
 * so the PaymentSheet flow could not ship on either store however well it
 * worked.
 */

/** The one entitlement the app sells. Must match the RevenueCat dashboard. */
const ENTITLEMENT = "premium";

/** Statuses under which the person is still entitled, subject to `endDate`. */
const LIVE_STATUSES = ["trialing", "active", "past_due"];

/**
 * "month" or "year" from a store product id.
 *
 * Product ids are set in the store consoles, not here, so this is a
 * convention rather than a table: name a yearly product with "year" or
 * "annual" in it.
 */
const intervalFor = (productId = "") =>
  /year|annual/i.test(productId) ? "year" : "month";

/**
 * What an event says the status now is. `null` means "unchanged" (a
 * cancellation is auto-renew turning off, not the entitlement ending);
 * `undefined` means the event carries no status at all.
 */
const statusFor = (event) => {
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
      return event.period_type === "TRIAL" ? "trialing" : "active";
    case "CANCELLATION":
      // A refund ends it now; opting out of renewal ends it at `endDate`.
      return event.cancel_reason === "CUSTOMER_SUPPORT" ? "canceled" : null;
    case "BILLING_ISSUE":
      // The store keeps the entitlement through its grace period and moves
      // `expiration_at_ms` to the end of it, so `endDate` still decides.
      return "past_due";
    case "SUBSCRIPTION_PAUSED":
      return "paused";
    case "EXPIRATION":
      return "canceled";
    default:
      return undefined;
  }
};

const isLive = (subscription) =>
  LIVE_STATUSES.includes(subscription.status) &&
  (!subscription.endDate || subscription.endDate > new Date());

/** The user an app_user_id names. The app configures it as the Firebase uid. */
const userFor = async (event) => {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ].filter((id) => typeof id === "string" && !id.startsWith("$RCAnonymousID"));

  if (candidates.length === 0) return null;
  return User.findOne({ firebaseUid: { $in: candidates } });
};

const setSubscribed = (userId, subscribed) =>
  User.updateOne({ _id: userId }, { subscribed });

/**
 * An entitlement moved between app user ids (a restore on a second account).
 * The old account loses it outright; the new one is flagged now and gets its
 * row from the next RENEWAL.
 */
const applyTransfer = async (event) => {
  const from = await User.find({ firebaseUid: { $in: event.transferred_from ?? [] } });
  for (const user of from) {
    await Subscription.updateMany(
      { user: user._id, status: { $in: LIVE_STATUSES } },
      { status: "canceled", endDate: new Date(), modifiedDate: new Date() }
    );
    await setSubscribed(user._id, false);
  }
  // ponytail: no row for the receiving account until its next RENEWAL, so
  // history is blank until then. Fetch the subscriber from RC's REST API if
  // that gap ever matters.
  await User.updateMany(
    { firebaseUid: { $in: event.transferred_to ?? [] } },
    { subscribed: true }
  );
};

/**
 * Mirrors one webhook event. Safe to call repeatedly: retries reuse the event
 * id and every write here is an upsert or a set, so a duplicate delivery
 * lands on the same row with the same values.
 *
 * Resolves to the stored subscription, or null when the event is one that
 * carries no subscription (TEST, TRANSFER, an unknown type) or names an
 * account that no longer exists - all of which are acknowledged rather than
 * retried, because RevenueCat retries a non-2xx for days.
 */
const syncFromEvent = async (event) => {
  if (!event || typeof event.type !== "string") return null;

  if (event.type === "TRANSFER") {
    await applyTransfer(event);
    return null;
  }

  const status = statusFor(event);
  if (status === undefined) return null;

  const user = await userFor(event);
  if (!user) {
    console.warn(`[revenuecat] ${event.type} for unknown app_user_id ${event.app_user_id}`);
    return null;
  }

  const key = event.original_transaction_id
    ? { user: user._id, originalTransactionId: event.original_transaction_id }
    : { user: user._id, productId: event.product_id };

  const update = {
    store: typeof event.store === "string" ? event.store.toLowerCase() : undefined,
    productId: event.product_id,
    planType: intervalFor(event.product_id),
    amount: typeof event.price === "number" ? event.price : undefined,
    currency: typeof event.currency === "string" ? event.currency.toLowerCase() : undefined,
    startDate: event.purchased_at_ms ? new Date(event.purchased_at_ms) : undefined,
    endDate: event.expiration_at_ms ? new Date(event.expiration_at_ms) : undefined,
    environment: event.environment,
    lastEventId: event.id,
    modifiedDate: new Date(),
  };
  if (status) update.status = status;
  if (event.type === "CANCELLATION") update.cancelAtPeriodEnd = true;
  if (["UNCANCELLATION", "INITIAL_PURCHASE", "RENEWAL"].includes(event.type)) {
    update.cancelAtPeriodEnd = false;
  }
  if (event.type === "EXPIRATION" && !update.endDate) update.endDate = new Date();

  // Mongoose writes `undefined` as an unset, which is the intent: an event
  // without a price must not blank a price a previous event recorded.
  for (const [field, value] of Object.entries(update)) {
    if (value === undefined) delete update[field];
  }

  const subscription = await Subscription.findOneAndUpdate(
    key,
    {
      $set: update,
      $setOnInsert: { user: user._id, createdDate: new Date(), ...key },
    },
    { upsert: true, returnDocument: "after" }
  );

  // Any live row entitles the person - a lapsed monthly next to a fresh yearly
  // must not read as "not subscribed".
  const live = await Subscription.exists({
    user: user._id,
    status: { $in: LIVE_STATUSES },
    $or: [{ endDate: null }, { endDate: { $gt: new Date() } }],
  });
  await setSubscribed(user._id, Boolean(live));

  return subscription;
};

module.exports = { ENTITLEMENT, LIVE_STATUSES, intervalFor, isLive, syncFromEvent };

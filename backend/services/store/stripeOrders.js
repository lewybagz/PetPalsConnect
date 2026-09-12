const mongoose = require("mongoose");
const Order = require("../../models/Order");
const User = require("../../models/User");
const { getStripe } = require("../../config/stripe");
const { findVariant } = require("./products");
const { notify } = require("../NotificationService");

/**
 * Stripe is the source of truth for an order; Mongo mirrors it.
 *
 * `syncFromEvent` is the only writer of `Order`, the way
 * `subscriptions/revenuecat.syncFromEvent` is the only writer of
 * `Subscription`. A webhook delivery is the one signal that money actually
 * moved: the redirect back into the app after Checkout says the person came
 * back, not that they paid, and an app that trusted it would ship goods for
 * abandoned sessions.
 *
 * Every write is an upsert keyed on the PaymentIntent, so Stripe's retries
 * and duplicate deliveries land on one row. Anything acknowledged answers 200
 * upstream, including event types we do not act on - Stripe retries a non-2xx
 * for days.
 */

/** The events that carry an order's whole state: the Session. */
const SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

/** The buyer named on a Session. Both fields are set by `checkout.js`. */
const userFor = async (session) => {
  const candidates = [session.client_reference_id, session.metadata?.userId].filter(
    (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
  );
  if (candidates.length === 0) return null;
  return User.findOne({ _id: { $in: candidates } }).select("_id").lean();
};

/** Stripe moved the shipping address between API versions; read either. */
const shippingFrom = (session) => {
  const details = session.collected_information?.shipping_details ?? session.shipping_details;
  if (!details) return undefined;
  const address = details.address ?? {};
  return {
    name: details.name,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postal_code,
    country: address.country,
  };
};

/**
 * What was charged, from Stripe's own line items rather than the catalogue,
 * so a later table edit cannot rewrite history. The sku comes back as the
 * Price's lookup key and is matched to the table only for display names.
 */
const itemsFor = async (stripe, sessionId) => {
  const page = await stripe.checkout.sessions.listLineItems(sessionId, {
    expand: ["data.price"],
    limit: 100,
  });

  return page.data.map((line) => {
    const sku = line.price?.lookup_key ?? undefined;
    const known = sku ? findVariant(sku) : null;
    return {
      sku,
      productId: known?.product.id,
      name: line.description ?? known?.product.name ?? "Item",
      variantLabel: known?.variant.label,
      quantity: line.quantity ?? 1,
      unitAmount: line.price?.unit_amount ?? undefined,
      currency: line.price?.currency ?? line.currency ?? undefined,
    };
  });
};

const statusForSession = (event, session) => {
  if (event.type === "checkout.session.async_payment_failed") return "failed";
  return session.payment_status === "paid" ? "paid" : "pending";
};

/** Mongoose writes `undefined` as an unset; strip so an absent field keeps its value. */
const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const upsertFromSession = async (event, session, stripe) => {
  if (session.mode !== "payment") return null;

  const user = await userFor(session);
  if (!user) {
    console.warn(`[stripe] ${event.type} for session ${session.id} with no known buyer`);
    return null;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const key = paymentIntentId ? { paymentIntentId } : { stripeSessionId: session.id };

  const update = compact({
    user: user._id,
    stripeSessionId: session.id,
    paymentIntentId,
    status: statusForSession(event, session),
    items: await itemsFor(stripe, session.id),
    amountSubtotal: session.amount_subtotal ?? undefined,
    amountTax: session.total_details?.amount_tax ?? undefined,
    amountShipping: session.total_details?.amount_shipping ?? undefined,
    amountTotal: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    shipping: shippingFrom(session),
    email: session.customer_details?.email ?? undefined,
    livemode: session.livemode,
    lastEventId: event.id,
    modifiedDate: new Date(),
  });

  return Order.findOneAndUpdate(
    key,
    { $set: update, $setOnInsert: { createdDate: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
};

/** A refund or a dispute names the PaymentIntent, and that is the row. */
const orderForCharge = (charge) => {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  return paymentIntentId ? Order.findOne({ paymentIntentId }) : null;
};

const applyRefund = async (event, charge) => {
  const order = await orderForCharge(charge);
  if (!order) return null;

  order.amountRefunded = charge.amount_refunded ?? order.amountRefunded;
  // A partial refund is a note on a paid order; only a full one ends it.
  if (charge.refunded) {
    order.status = "refunded";
    order.refundedAt = new Date();
  }
  order.lastEventId = event.id;
  order.modifiedDate = new Date();
  return order.save();
};

const applyDispute = async (event, dispute) => {
  const order = await orderForCharge(dispute);
  if (!order) return null;
  order.status = "disputed";
  order.lastEventId = event.id;
  order.modifiedDate = new Date();
  return order.save();
};

/**
 * Mirrors one webhook event. Resolves to the order, or null when the event is
 * one that carries none - all of which the route acknowledges rather than
 * retries.
 */
const syncFromEvent = async (event, stripe = getStripe()) => {
  if (!event || typeof event.type !== "string") return null;
  const object = event.data?.object;
  if (!object) return null;

  if (SESSION_EVENTS.has(event.type)) return upsertFromSession(event, object, stripe);
  if (event.type === "charge.refunded") return applyRefund(event, object);
  if (event.type === "charge.dispute.created") return applyDispute(event, object);
  return null;
};

/**
 * The one status Stripe does not know: the parcel left.
 *
 * Fulfilment belongs to whoever packs the box - a 3PL's webhook eventually,
 * an operator for now, through the moderator-guarded route. Tells the buyer
 * through `notify()`, the same path every other event uses, so a muted
 * category and quiet hours are respected here too.
 */
const markFulfilled = async (orderId, { carrier, trackingNumber } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) return null;
  if (!["paid", "fulfilled"].includes(order.status)) {
    const error = new Error("Only a paid order can be fulfilled.");
    error.status = 409;
    throw error;
  }

  const first = order.status !== "fulfilled";
  order.status = "fulfilled";
  order.carrier = carrier || order.carrier;
  order.trackingNumber = trackingNumber || order.trackingNumber;
  order.fulfilledAt = order.fulfilledAt ?? new Date();
  order.modifiedDate = new Date();
  await order.save();

  if (first) {
    const what = order.items[0]?.name ?? "Your order";
    const more = order.items.length > 1 ? ` and ${order.items.length - 1} more` : "";
    await notify({
      recipientId: order.user,
      type: "orderShipped",
      content: `${what}${more} is on its way.`,
      data: { orderId: String(order._id) },
    }).catch((error) => console.warn("[store] shipped notification failed:", error.message));
  }

  return order;
};

module.exports = { syncFromEvent, markFulfilled, SESSION_EVENTS };

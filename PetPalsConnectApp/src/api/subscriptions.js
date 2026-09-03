import api from "./axios";

import { STRIPE_PUBLISHABLE_KEY } from "../config/env";

/**
 * The subscription half of the API surface.
 *
 * Every one of these paths used to be something else: the app called
 * `/api/subscriptions/create-checkout-session` (a browser flow a native app
 * cannot complete), `/api/subscriptions/:userId` (identity comes from the
 * token, never the URL), and `/renew` and `/change-plan`, neither of which the
 * server has ever implemented. Keeping the paths in one module means the
 * backend contract test has a single place to check.
 */

/** True when this build was given a publishable key to talk to Stripe with. */
export const paymentsConfigured = () =>
  typeof STRIPE_PUBLISHABLE_KEY === "string" &&
  STRIPE_PUBLISHABLE_KEY.startsWith("pk_");

/**
 * The plans the server is willing to sell, each with `available` resolved.
 * Prices live in Stripe, so the app never hardcodes an amount - the old
 * screen's "$4.99/month" was decoration with nothing behind it.
 */
export const fetchPlans = async () => {
  const { data } = await api.get("/api/subscriptions/plans");
  return {
    plans: data?.plans ?? [],
    paymentsEnabled: Boolean(data?.paymentsEnabled) && paymentsConfigured(),
  };
};

/** The caller's current subscription, or null. */
export const fetchCurrentSubscription = async () => {
  const { data } = await api.get("/api/subscriptions/me");
  return data ?? null;
};

/** Starts a subscription. Returns the parameters PaymentSheet needs. */
export const createSubscription = async (planId) => {
  const { data } = await api.post("/api/subscriptions", { planId });
  return data;
};

/** Cancels at period end - the user keeps the time they already paid for. */
export const cancelSubscription = async () => {
  const { data } = await api.post("/api/subscriptions/cancel");
  return data;
};

/** Undoes a pending cancellation. */
export const resumeSubscription = async () => {
  const { data } = await api.post("/api/subscriptions/resume");
  return data;
};

/** Every subscription this account has had, newest first. */
export const fetchSubscriptionHistory = async () => {
  const { data } = await api.get("/api/subscription-history");
  return Array.isArray(data) ? data : [];
};

/** Statuses that mean "this person is entitled to paid features right now". */
export const LIVE_STATUSES = ["active", "trialing"];

export const isLive = (subscription) =>
  Boolean(subscription) && LIVE_STATUSES.includes(subscription.status);

/** Human wording for a Stripe status, so screens do not each invent their own. */
export const describeStatus = (subscription) => {
  if (!subscription) return "No subscription";
  if (subscription.status === "active" && subscription.cancelAtPeriodEnd) {
    return "Active - ends at the end of this period";
  }
  return (
    {
      incomplete: "Waiting for payment",
      incomplete_expired: "Payment was not completed",
      trialing: "Free trial",
      active: "Active",
      past_due: "Payment failed - please update your card",
      canceled: "Cancelled",
      unpaid: "Unpaid",
    }[subscription.status] ?? subscription.status
  );
};

/** Formats a stored amount (major units) for display. */
export const formatPrice = (amount, currency = "usd") => {
  if (amount == null) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    // Some Hermes builds ship without full ICU data for every currency.
    return `${amount} ${currency.toUpperCase()}`;
  }
};

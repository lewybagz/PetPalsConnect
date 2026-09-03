/**
 * The plans the app offers.
 *
 * Prices live in Stripe; this maps the app's plan ids onto Stripe price ids so
 * the client never sends an amount. A client-supplied price is the classic way
 * to end up selling a subscription for a penny.
 *
 * Set the STRIPE_PRICE_* variables from your Stripe dashboard. A plan without a
 * configured price id is reported as unavailable rather than half-working.
 */
const PLANS = [
  {
    id: "monthly",
    name: "PetPals Plus (Monthly)",
    description: "Unlimited matches, priority playdates and no ads.",
    interval: "month",
    priceEnvVar: "STRIPE_PRICE_MONTHLY",
  },
  {
    id: "yearly",
    name: "PetPals Plus (Yearly)",
    description: "Everything in Plus, at two months free.",
    interval: "year",
    priceEnvVar: "STRIPE_PRICE_YEARLY",
  },
];

/** The Stripe price id for a plan, or null when it is not configured. */
const priceIdFor = (planId) => {
  const plan = PLANS.find((candidate) => candidate.id === planId);
  if (!plan) return null;
  return process.env[plan.priceEnvVar] || null;
};

/** Plans with their availability resolved, for the app's plan picker. */
const listPlans = () =>
  PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    interval: plan.interval,
    available: Boolean(process.env[plan.priceEnvVar]),
  }));

module.exports = { PLANS, priceIdFor, listPlans };

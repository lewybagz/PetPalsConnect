const env = require("../../config/env");
const { getStripe } = require("../../config/stripe");
const { findVariant, allSkus, MAX_QUANTITY, MAX_LINES } = require("./products");

/**
 * Turning a list of skus into a Stripe Checkout Session.
 *
 * Checkout is a hosted page, not an in-app sheet. Stripe collects the card,
 * the shipping address and the sales tax on its own domain, which keeps three
 * things out of this repo: card data (no PCI scope), an address form, and US
 * tax calculation (`automatic_tax`). Apple explicitly permits opening a
 * browser to buy physical goods; it is the sanctioned route, not a workaround.
 *
 * The only thing the client sends is `{ sku, quantity }` pairs. Prices are
 * looked up by Stripe lookup key here and handed over as Price ids - a client
 * never names an amount, which is the oldest hole in e-commerce and the one
 * `store.test.js` checks first.
 */

class CheckoutError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Live Prices by lookup key, cached briefly.
 *
 * ponytail: one in-process cache with a five-minute TTL. A price edit in the
 * dashboard takes up to five minutes to show in the app, and a multi-instance
 * deployment has one cache per instance. Move to a shared cache if either
 * ever matters.
 */
const PRICE_TTL_MS = 5 * 60 * 1000;
let priceCache = { at: 0, bySku: new Map() };

const resetPriceCache = () => {
  priceCache = { at: 0, bySku: new Map() };
};

const pricesBySku = async () => {
  const stripe = getStripe();
  if (!stripe) return new Map();
  if (Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.bySku;

  const bySku = new Map();
  const skus = allSkus();
  // `lookup_keys` takes at most ten per call.
  for (let i = 0; i < skus.length; i += 10) {
    const page = await stripe.prices.list({
      lookup_keys: skus.slice(i, i + 10),
      active: true,
      limit: 100,
    });
    for (const price of page.data) {
      if (price.lookup_key) bySku.set(price.lookup_key, price);
    }
  }

  priceCache = { at: Date.now(), bySku };
  return bySku;
};

/** The catalogue with each variant's live price, or null where there is none. */
const priceCatalogue = async (products) => {
  const prices = await pricesBySku();
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => {
      const price = prices.get(variant.sku);
      return {
        ...variant,
        price: price
          ? { amount: price.unit_amount, currency: price.currency }
          : null,
      };
    }),
  }));
};

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/**
 * Validates the body's items down to `[{ sku, quantity }]`, merging duplicate
 * skus. Anything malformed is a 400 with a reason the app can show.
 */
const normaliseItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError(400, "Choose something to buy first.", "EMPTY_ORDER");
  }

  const merged = new Map();
  for (const entry of items) {
    const sku = typeof entry?.sku === "string" ? entry.sku : null;
    const quantity = entry?.quantity == null ? 1 : Number(entry.quantity);
    if (!sku || !findVariant(sku)) {
      throw new CheckoutError(400, "That item isn't in the shop.", "UNKNOWN_ITEM");
    }
    if (!isPositiveInt(quantity)) {
      throw new CheckoutError(400, "Quantity has to be a whole number.", "BAD_QUANTITY");
    }
    merged.set(sku, (merged.get(sku) ?? 0) + quantity);
  }

  if (merged.size > MAX_LINES) {
    throw new CheckoutError(400, `At most ${MAX_LINES} different items per order.`, "TOO_MANY_LINES");
  }
  for (const [sku, quantity] of merged) {
    if (quantity > MAX_QUANTITY) {
      throw new CheckoutError(
        400,
        `At most ${MAX_QUANTITY} of one item per order.`,
        "BAD_QUANTITY"
      );
    }
    merged.set(sku, quantity);
  }

  return [...merged].map(([sku, quantity]) => ({ sku, quantity }));
};

/**
 * Creates the Session and returns `{ id, url }` for the app to open.
 *
 * `client_reference_id` and `metadata.userId` both carry the buyer, because the
 * webhook resolves the order to an account from the Session and nothing else -
 * the redirect back into the app proves nothing about who paid or whether
 * they did.
 */
const createCheckoutSession = async ({ user, items }) => {
  const stripe = getStripe();
  if (!stripe) throw new CheckoutError(503, "The shop isn't open yet.", "STORE_DISABLED");

  const lines = normaliseItems(items);
  const prices = await pricesBySku();

  const lineItems = lines.map(({ sku, quantity }) => {
    const price = prices.get(sku);
    if (!price) {
      throw new CheckoutError(409, "That item isn't available right now.", "NOT_FOR_SALE");
    }
    return { price: price.id, quantity };
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    client_reference_id: String(user._id),
    customer_email: user.email || undefined,
    metadata: { userId: String(user._id) },
    automatic_tax: { enabled: true },
    // ponytail: US only. Shipping to Canada is a customs and tax question, not
    // a config change; widen this when there is an answer to it.
    shipping_address_collection: { allowed_countries: ["US"] },
    ...(env.stripe.shippingRateIds.length > 0
      ? { shipping_options: env.stripe.shippingRateIds.map((id) => ({ shipping_rate: id })) }
      : {}),
    // Back into the app. The success screen says "confirming", never "paid":
    // the webhook lands a moment after this redirect and the redirect is not
    // proof of payment.
    success_url: `${env.stripe.returnUrl}/order/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.stripe.returnUrl}/cancelled`,
  });

  return { id: session.id, url: session.url };
};

module.exports = {
  CheckoutError,
  normaliseItems,
  pricesBySku,
  priceCatalogue,
  createCheckoutSession,
  resetPriceCache,
};

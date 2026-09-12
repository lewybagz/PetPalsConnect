import { Linking } from "react-native";

import api from "./axios";
import type { Order, OrderStatus, StoreProduct, StoreVariant } from "../types/api";

/**
 * The shop, from the app's side.
 *
 * Buying happens on Stripe's hosted Checkout page, opened in the browser:
 * physical goods must not go through in-app purchase (Apple 3.1.3(e), Play's
 * physical-goods rule), and a hosted page keeps card data out of the app
 * entirely. So this module lists the catalogue, opens a Session, and reads
 * orders back. It never sends a price - a client naming an amount is the
 * oldest hole in e-commerce - and it never decides an order is paid: only the
 * server's webhook does, which is why `fetchOrderBySession` can answer "not
 * yet" for a moment after the buyer comes back.
 */

export interface Catalogue {
  /** False when the server has no Stripe key: the shop is not open yet. */
  configured: boolean;
  categories: { key: string; label: string }[];
  products: StoreProduct[];
}

export interface CheckoutLine {
  sku: string;
  quantity: number;
}

/** The catalogue with live prices. */
export const fetchCatalogue = async (): Promise<Catalogue> => {
  const { data } = await api.get("/api/store/products");
  return {
    configured: Boolean(data?.configured),
    categories: Array.isArray(data?.categories) ? data.categories : [],
    products: Array.isArray(data?.products) ? data.products : [],
  };
};

/**
 * Opens Stripe Checkout for the given lines. Resolves once the browser has
 * been asked to open; whether the person pays is the webhook's to report.
 */
export const startCheckout = async (items: CheckoutLine[]): Promise<{ id: string; url: string }> => {
  const { data } = await api.post("/api/store/checkout", { items });
  if (typeof data?.url !== "string") throw new Error("Checkout did not return a page to open.");
  await Linking.openURL(data.url);
  return { id: data.id, url: data.url };
};

/** The caller's orders, newest first. */
export const fetchOrders = async (): Promise<Order[]> => {
  const { data } = await api.get("/api/store/orders");
  return Array.isArray(data) ? data : [];
};

/** One order of the caller's own. */
export const fetchOrder = async (orderId: string): Promise<Order> => {
  const { data } = await api.get(`/api/store/orders/${orderId}`);
  return data;
};

/**
 * The order for a Checkout Session the buyer just returned from, or null
 * while the webhook has not landed. Null is the normal state for the first
 * few seconds, not an error.
 */
export const fetchOrderBySession = async (sessionId: string): Promise<Order | null> => {
  try {
    const { data } = await api.get(`/api/store/orders/by-session/${sessionId}`);
    return data;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw error;
  }
};

/** What each status says to the buyer. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Confirming payment",
  paid: "Paid - getting it ready",
  fulfilled: "Shipped",
  refunded: "Refunded",
  disputed: "Payment disputed",
  failed: "Payment failed",
};

/** Minor units to a currency string: 2800 -> "$28.00". */
export const formatMinor = (amount?: number | null, currency: string = "usd"): string => {
  if (amount == null || !Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
};

/** The cheapest purchasable variant's price, for "From $28" on a card. */
export const fromPrice = (product: StoreProduct): StoreVariant["price"] => {
  const priced = product.variants
    .map((variant) => variant.price)
    .filter((price): price is NonNullable<StoreVariant["price"]> => price != null);
  if (priced.length === 0) return null;
  return priced.reduce((low, price) => (price.amount < low.amount ? price : low));
};

/** "PetPals Tee" or "PetPals Tee and 2 more". */
export const describeItems = (order: Pick<Order, "items">): string => {
  const [first, ...rest] = order.items ?? [];
  if (!first) return "Order";
  const others = rest.reduce((sum, item) => sum + (item.quantity || 1), 0) + (first.quantity - 1);
  return others > 0 ? `${first.name} and ${others} more` : first.name;
};

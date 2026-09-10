import { Linking, Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import api from "./axios";
import { REVENUECAT_API_KEY } from "../config/env";
import type { Subscription, SubscriptionStatus } from "../types/api";

/**
 * The subscription half of the API surface.
 *
 * Buying happens against the store - StoreKit on iOS, Play Billing on
 * Android - through RevenueCat, which validates the receipt and tells the
 * server what happened over a webhook. So the server has nothing to create,
 * cancel or resume: those are the store's, and this module only reads back
 * what the server was told.
 *
 * Stripe's PaymentSheet was here before. A subscription that unlocks in-app
 * features has to use native IAP (Apple 3.1.1, Play's payments policy), so
 * however well it worked it could not ship on either store.
 */

/** The one entitlement the app sells. Mirrors `ENTITLEMENT` on the server. */
export const ENTITLEMENT = "premium";

/**
 * True when this build was given a RevenueCat key. RevenueCat keys are
 * prefixed by platform (`appl_`, `goog_`) or `test_` for its test store, so
 * a placeholder left in `.env` does not count as configured.
 */
export const purchasesConfigured = (): boolean =>
  typeof REVENUECAT_API_KEY === "string" && /^(appl|goog|test)_/.test(REVENUECAT_API_KEY);

let configuredFor: string | null = null;

/**
 * Points the SDK at the signed-in person, or at nobody.
 *
 * The app user id is the Firebase uid, which is what the server's webhook
 * resolves to a profile. Configuring once and logging in on later changes is
 * what the SDK asks for; configuring twice is an error.
 */
export const syncPurchasesUser = async (uid: string | null): Promise<void> => {
  if (!purchasesConfigured()) return;
  if (uid === configuredFor) return;

  if (configuredFor === null) {
    if (!uid) return;
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY as string, appUserID: uid });
    configuredFor = uid;
    return;
  }

  if (uid) {
    await Purchases.logIn(uid);
  } else {
    // Signing out of an account the SDK identified by uid; an anonymous
    // session has nothing to log out of and the SDK says so with a throw.
    await Purchases.logOut().catch(() => {});
  }
  configuredFor = uid;
};

/** The packages on the current offering, in the order the dashboard lists them. */
export const fetchPackages = async (): Promise<PurchasesPackage[]> => {
  if (!purchasesConfigured()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
};

export const hasPremium = (info: CustomerInfo | null | undefined): boolean =>
  Boolean(info?.entitlements.active[ENTITLEMENT]);

/**
 * Buys a package. Resolves to whether the person now holds the entitlement,
 * or `null` when they closed the sheet - which is a normal thing to do, not
 * an error to report.
 */
export const purchase = async (pkg: PurchasesPackage): Promise<boolean | null> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPremium(customerInfo);
  } catch (error) {
    if ((error as { userCancelled?: boolean })?.userCancelled) return null;
    throw error;
  }
};

/** Apple requires this wherever purchases are offered: a reinstall gets its subscription back. */
export const restore = async (): Promise<boolean> =>
  hasPremium(await Purchases.restorePurchases());

/**
 * Opens the store's own subscription management page.
 *
 * The SDK knows the exact page for the account that bought; without one the
 * store's general subscriptions page is the next best thing.
 */
export const openManagement = async (): Promise<void> => {
  let url: string | null = null;
  try {
    url = (await Purchases.getCustomerInfo()).managementURL;
  } catch {
    // Fall through to the store page.
  }
  await Linking.openURL(
    url ??
      Platform.select({
        ios: "https://apps.apple.com/account/subscriptions",
        default: "https://play.google.com/store/account/subscriptions",
      })
  );
};

/** The caller's current subscription, or null. */
export const fetchCurrentSubscription = async (): Promise<Subscription | null> => {
  const { data } = await api.get("/api/subscriptions/me");
  return data ?? null;
};

/** Every subscription this account has had, newest first. */
export const fetchSubscriptionHistory = async (): Promise<Subscription[]> => {
  const { data } = await api.get("/api/subscriptions/history");
  return Array.isArray(data) ? data : [];
};

/** Statuses that mean "entitled right now", subject to `endDate`. */
export const LIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due"];

export const isLive = (subscription?: Subscription | null): boolean =>
  Boolean(subscription) &&
  LIVE_STATUSES.includes(subscription!.status) &&
  (!subscription!.endDate || new Date(subscription!.endDate) > new Date());

/** Human wording for a status, so screens do not each invent their own. */
export const describeStatus = (subscription?: Subscription | null): string => {
  if (!subscription) return "No subscription";
  if (subscription.status === "active" && subscription.cancelAtPeriodEnd) {
    return "Active - ends at the end of this period";
  }
  return (
    ({
      trialing: "Free trial",
      active: "Active",
      past_due: "Payment failed - check your payment method in the store",
      paused: "Paused",
      canceled: "Cancelled",
    } as Record<SubscriptionStatus, string>)[subscription.status] ?? subscription.status
  );
};

/** Formats a stored amount (major units) for display. */
export const formatPrice = (amount?: number | null, currency: string = "usd"): string => {
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

/** Test seam: forget which account the SDK was configured for. */
export const __resetPurchasesForTests = (): void => {
  configuredFor = null;
};

import { Linking } from "react-native";
import Purchases from "react-native-purchases";

import api from "./axios";
import {
  __resetPurchasesForTests,
  describeStatus,
  fetchCurrentSubscription,
  fetchPackages,
  fetchSubscriptionHistory,
  formatPrice,
  hasPremium,
  isLive,
  openManagement,
  purchase,
  purchasesConfigured,
  restore,
  syncPurchasesUser,
} from "./subscriptions";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn() }));

let mockKey = "appl_stub";
jest.mock("../config/env", () => ({
  get REVENUECAT_API_KEY() {
    return mockKey;
  },
  API_URL: "http://localhost:4000",
}));

const info = (active) => ({ entitlements: { active }, managementURL: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockKey = "appl_stub";
  __resetPurchasesForTests();
});

describe("paths", () => {
  /**
   * The app half of the backend's contract test: the only two subscription
   * reads left, both the caller's own. Everything that used to write - create,
   * cancel, resume - is the store's now and must not be called.
   */
  it("asks for the caller's own subscription, never one by user id", async () => {
    api.get.mockResolvedValue({ data: null });
    await fetchCurrentSubscription();
    expect(api.get).toHaveBeenCalledWith("/api/subscriptions/me");
  });

  it("reads history from the subscriptions router", async () => {
    api.get.mockResolvedValue({ data: null });
    expect(await fetchSubscriptionHistory()).toEqual([]);
    expect(api.get).toHaveBeenCalledWith("/api/subscriptions/history");
  });
});

describe("configuration", () => {
  it("is off without a RevenueCat key, so the app still opens", () => {
    mockKey = undefined;
    expect(purchasesConfigured()).toBe(false);
  });

  it("is off for a placeholder that is not a RevenueCat key", () => {
    mockKey = "changeme";
    expect(purchasesConfigured()).toBe(false);
  });

  it("configures once with the Firebase uid, then logs in on a change of account", async () => {
    await syncPurchasesUser("uid-1");
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_stub", appUserID: "uid-1" });

    await syncPurchasesUser("uid-1");
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.logIn).not.toHaveBeenCalled();

    await syncPurchasesUser("uid-2");
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.logIn).toHaveBeenCalledWith("uid-2");
  });

  it("logs out on sign-out and does not configure for nobody", async () => {
    await syncPurchasesUser(null);
    expect(Purchases.configure).not.toHaveBeenCalled();

    await syncPurchasesUser("uid-1");
    await syncPurchasesUser(null);
    expect(Purchases.logOut).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all without a key", async () => {
    mockKey = undefined;
    await syncPurchasesUser("uid-1");
    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(await fetchPackages()).toEqual([]);
    expect(Purchases.getOfferings).not.toHaveBeenCalled();
  });
});

describe("buying", () => {
  it("lists the current offering's packages", async () => {
    Purchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ identifier: "$rc_monthly" }] },
    });
    expect(await fetchPackages()).toEqual([{ identifier: "$rc_monthly" }]);
  });

  it("is an empty list when the dashboard has no current offering", async () => {
    Purchases.getOfferings.mockResolvedValue({ current: null });
    expect(await fetchPackages()).toEqual([]);
  });

  it("reports the entitlement after a purchase", async () => {
    Purchases.purchasePackage.mockResolvedValue({ customerInfo: info({ premium: {} }) });
    expect(await purchase({ identifier: "$rc_monthly" })).toBe(true);

    Purchases.purchasePackage.mockResolvedValue({ customerInfo: info({}) });
    expect(await purchase({ identifier: "$rc_monthly" })).toBe(false);
  });

  it("treats closing the sheet as nothing happening, not an error", async () => {
    Purchases.purchasePackage.mockRejectedValue({ userCancelled: true, message: "cancelled" });
    expect(await purchase({ identifier: "$rc_monthly" })).toBeNull();
  });

  it("lets any other purchase failure through", async () => {
    Purchases.purchasePackage.mockRejectedValue(new Error("network"));
    await expect(purchase({ identifier: "$rc_monthly" })).rejects.toThrow("network");
  });

  it("restores and reports the entitlement", async () => {
    Purchases.restorePurchases.mockResolvedValue(info({ premium: {} }));
    expect(await restore()).toBe(true);
  });

  it("recognises the one entitlement the app sells and nothing else", () => {
    expect(hasPremium(info({ premium: {} }))).toBe(true);
    expect(hasPremium(info({ gold: {} }))).toBe(false);
    expect(hasPremium(null)).toBe(false);
  });
});

describe("managing", () => {
  it("opens the store's page for this account when the SDK knows it", async () => {
    Purchases.getCustomerInfo.mockResolvedValue({
      ...info({}),
      managementURL: "https://apps.apple.com/account/subscriptions?x=1",
    });
    await openManagement();
    expect(Linking.openURL).toHaveBeenCalledWith(
      "https://apps.apple.com/account/subscriptions?x=1"
    );
  });

  it("falls back to the store's general subscriptions page", async () => {
    Purchases.getCustomerInfo.mockRejectedValue(new Error("not configured"));
    await openManagement();
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/subscriptions$/));
  });
});

describe("status wording", () => {
  it("treats a live status with a future end as live", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isLive({ status: "active", endDate: future })).toBe(true);
    expect(isLive({ status: "trialing" })).toBe(true);
    expect(isLive({ status: "past_due", endDate: future })).toBe(true);
    expect(isLive({ status: "active", endDate: past })).toBe(false);
    expect(isLive({ status: "canceled" })).toBe(false);
    expect(isLive(null)).toBe(false);
  });

  it("says an active-but-cancelling subscription is ending", () => {
    expect(describeStatus({ status: "active", cancelAtPeriodEnd: true })).toMatch(/ends/i);
  });

  it("points a failed payment at the store, where the card lives", () => {
    expect(describeStatus({ status: "past_due" })).toMatch(/store/i);
  });

  it("falls back to the raw status for anything unrecognised", () => {
    expect(describeStatus({ status: "future_status" })).toBe("future_status");
  });
});

describe("price formatting", () => {
  it("formats a stored major-unit amount", () => {
    expect(formatPrice(9.99, "usd")).toContain("9.99");
  });

  it("renders nothing for a missing amount instead of NaN", () => {
    expect(formatPrice(null)).toBe("");
  });
});

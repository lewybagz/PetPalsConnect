import api from "./axios";
import {
  cancelSubscription,
  createSubscription,
  describeStatus,
  fetchCurrentSubscription,
  fetchPlans,
  fetchSubscriptionHistory,
  formatPrice,
  isLive,
  paymentsConfigured,
  resumeSubscription,
} from "./subscriptions";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn() }));

let mockPublishableKey = "pk_test_stub";
jest.mock("../config/env", () => ({
  get STRIPE_PUBLISHABLE_KEY() {
    return mockPublishableKey;
  },
  API_URL: "http://localhost:4000",
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPublishableKey = "pk_test_stub";
});

describe("paths", () => {
  /**
   * These assertions are the app half of the backend's contract test. Every
   * one of these paths was wrong before: the app called a Checkout endpoint
   * that cannot work natively, and `/api/subscriptions/:userId`, `/renew` and
   * `/change-plan`, none of which the server implements.
   */
  it("reads plans from the server rather than hardcoding them", async () => {
    api.get.mockResolvedValue({ data: { plans: [{ id: "monthly" }], paymentsEnabled: true } });

    const result = await fetchPlans();

    expect(api.get).toHaveBeenCalledWith("/api/subscriptions/plans");
    expect(result.plans).toEqual([{ id: "monthly" }]);
  });

  it("asks for the caller's own subscription, never one by user id", async () => {
    api.get.mockResolvedValue({ data: null });
    await fetchCurrentSubscription();
    expect(api.get).toHaveBeenCalledWith("/api/subscriptions/me");
  });

  it("sends only a plan id when subscribing", async () => {
    api.post.mockResolvedValue({ data: {} });
    await createSubscription("monthly");
    // No amount, no price id: a client-supplied price sells a year for a penny.
    expect(api.post).toHaveBeenCalledWith("/api/subscriptions", { planId: "monthly" });
  });

  it("cancels and resumes through the endpoints that exist", async () => {
    api.post.mockResolvedValue({ data: {} });
    await cancelSubscription();
    await resumeSubscription();
    expect(api.post).toHaveBeenNthCalledWith(1, "/api/subscriptions/cancel");
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/subscriptions/resume");
  });

  it("returns an array from history even when the server sends something else", async () => {
    api.get.mockResolvedValue({ data: null });
    expect(await fetchSubscriptionHistory()).toEqual([]);
  });
});

describe("payment availability", () => {
  it("is false without a publishable key, so the app still opens", () => {
    mockPublishableKey = undefined;
    expect(paymentsConfigured()).toBe(false);
  });

  it("is false for a placeholder that is not a Stripe key", () => {
    mockPublishableKey = "changeme";
    expect(paymentsConfigured()).toBe(false);
  });

  it("reports payments disabled when the app has no key, whatever the server says", async () => {
    mockPublishableKey = undefined;
    api.get.mockResolvedValue({ data: { plans: [], paymentsEnabled: true } });

    expect((await fetchPlans()).paymentsEnabled).toBe(false);
  });
});

describe("status wording", () => {
  it("treats only active and trialing as live", () => {
    expect(isLive({ status: "active" })).toBe(true);
    expect(isLive({ status: "trialing" })).toBe(true);
    expect(isLive({ status: "past_due" })).toBe(false);
    expect(isLive(null)).toBe(false);
  });

  it("says an active-but-cancelling subscription is ending", () => {
    expect(describeStatus({ status: "active", cancelAtPeriodEnd: true })).toMatch(/ends/i);
  });

  it("explains a failed payment rather than showing a raw status", () => {
    expect(describeStatus({ status: "past_due" })).toMatch(/update your card/i);
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

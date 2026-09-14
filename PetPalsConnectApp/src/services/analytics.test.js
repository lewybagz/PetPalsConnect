import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../api/axios";
import { track, trackOnce, flush, resetAnalytics } from "./analytics";

jest.mock("../api/axios", () => ({ post: jest.fn() }));

/**
 * The one rule this service has: it must never be the reason something else
 * breaks. A dropped event is always the right trade against a broken signup,
 * so every failure path here is checked to be silent - and the buffer has to
 * survive the failure, because the events worth most are the ones from the
 * ninety seconds that ended in a force-quit.
 */
describe("analytics", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await resetAnalytics();
    api.post.mockResolvedValue({ data: { recorded: 1 } });
  });

  it("buffers events and sends them as one batch", async () => {
    track("app_opened");
    track("signup_started");

    // Nothing is sent until a flush: the point of buffering is that the first
    // ninety seconds are exactly when the network is least likely to be warm.
    expect(api.post).not.toHaveBeenCalled();

    await flush();

    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body] = api.post.mock.calls[0];
    expect(path).toBe("/api/analytics/events");
    expect(body.events.map((e) => e.name)).toEqual(["app_opened", "signup_started"]);
  });

  it("stamps each event with when it happened, not when it was sent", async () => {
    track("account_created");
    await flush();

    const [, body] = api.post.mock.calls[0];
    // An ISO string the server can trust within a day either side.
    expect(Date.parse(body.events[0].at)).toBeLessThanOrEqual(Date.now());
    expect(Number.isNaN(Date.parse(body.events[0].at))).toBe(false);
  });

  it("keeps the events when the send fails, and resends them next time", async () => {
    api.post.mockRejectedValueOnce(new Error("offline"));

    track("profile_started");
    // Must not throw: a rejected flush on a UI path is the failure mode this
    // whole service is written to avoid.
    await expect(flush()).resolves.toBeUndefined();

    api.post.mockResolvedValue({ data: {} });
    await flush();

    const [, body] = api.post.mock.calls[1];
    expect(body.events.map((e) => e.name)).toEqual(["profile_started"]);
  });

  it("never throws when storage is broken", async () => {
    const setItem = jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValue(new Error("storage full"));

    expect(() => track("pet_created")).not.toThrow();
    await expect(flush()).resolves.toBeUndefined();

    setItem.mockRestore();
  });

  it("sends nothing when there is nothing buffered", async () => {
    await flush();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("trackOnce sends a milestone once per account, and again for another", async () => {
    await trackOnce("first_swipe", "account-a");
    await trackOnce("first_swipe", "account-a");
    await trackOnce("first_swipe", "account-b");

    await flush();

    const [, body] = api.post.mock.calls[0];
    expect(body.events).toHaveLength(2);
    expect(body.events.every((e) => e.name === "first_swipe")).toBe(true);
  });

  it("resetAnalytics drops the buffer without sending it", async () => {
    track("first_match");
    await resetAnalytics();
    await flush();

    // Signing out must not leave one person's events to be flushed under the
    // next person's token on a shared phone.
    expect(api.post).not.toHaveBeenCalled();
  });
});

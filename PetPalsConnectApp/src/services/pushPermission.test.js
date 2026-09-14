import { Alert } from "react-native";
import {
  getToken,
  hasPermission,
  requestPermission,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import api from "../api/axios";
import { requestPushPermission, registerDeviceToken } from "./pushPermission";

jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  hasPermission: jest.fn(),
  requestPermission: jest.fn(),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

jest.mock("../api/axios", () => ({ post: jest.fn() }));
jest.mock("./analytics", () => ({ track: jest.fn() }));

/**
 * The rule this exists to enforce: the app explains before the OS asks.
 *
 * `usePushNotifications` used to call `requestPermission` from a mount effect
 * the instant the session went ready - no context, no way to say later. On iOS
 * that prompt fires once and permanently, so that was the app's only chance at
 * it, spent on somebody who had just closed a form and seen nothing.
 *
 * Same three properties `location.test.js` checks, because it is the same
 * pattern: the explanation comes first, "Not now" does not reach the OS, and
 * somebody who already answered is not asked again.
 */
const answer = (label) =>
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    buttons.find((b) => b.text === label).onPress();
  });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  hasPermission.mockResolvedValue(AuthorizationStatus.NOT_DETERMINED);
  requestPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
  getToken.mockResolvedValue("device-token");
  api.post.mockResolvedValue({ data: {} });
});

describe("requestPushPermission", () => {
  it("explains what the notifications are for before the OS asks", async () => {
    const alert = answer("Turn on");

    expect(await requestPushPermission({ petName: "Rex" })).toBe("granted");

    expect(alert).toHaveBeenCalledTimes(1);
    const [, message] = alert.mock.calls[0];
    // Names the actual dog, which is the reason to ask here and not on launch.
    expect(message).toMatch(/Rex/);
    // Says what it will and will not send.
    expect(message).toMatch(/no marketing/i);

    // The OS is asked only after the explanation.
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("falls back to 'your pet' when there is no pet to name", async () => {
    answer("Turn on");
    await requestPushPermission();

    const [, message] = Alert.alert.mock.calls[0];
    expect(message).toMatch(/your pet/i);
  });

  it("treats Not now as postponed, without asking the OS", async () => {
    answer("Not now");

    expect(await requestPushPermission({ petName: "Rex" })).toBe("postponed");

    // The single most important assertion here: iOS only ever shows this
    // prompt once, so spending it on somebody who said "later" is spending it.
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("does not ask again when permission is already granted", async () => {
    const alert = answer("Turn on");
    hasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);

    expect(await requestPushPermission()).toBe("granted");

    expect(alert).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    // ...but the token is still refreshed, because tokens rotate.
    expect(api.post).toHaveBeenCalledWith("/api/notifications/device-token", {
      fcmToken: "device-token",
    });
  });

  it("does not nag somebody who already refused at the OS level", async () => {
    const alert = answer("Turn on");
    hasPermission.mockResolvedValue(AuthorizationStatus.DENIED);

    expect(await requestPushPermission()).toBe("blocked");

    expect(alert).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("reports a refusal at the OS prompt as denied, not postponed", async () => {
    answer("Turn on");
    requestPermission.mockResolvedValue(AuthorizationStatus.DENIED);

    // Distinct from "postponed" on purpose: only one of the two is worth
    // offering again later.
    expect(await requestPushPermission()).toBe("denied");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("treats provisional authorisation as granted", async () => {
    answer("Turn on");
    requestPermission.mockResolvedValue(AuthorizationStatus.PROVISIONAL);

    expect(await requestPushPermission()).toBe("granted");
  });

  it("never throws when messaging is unavailable", async () => {
    hasPermission.mockRejectedValue(new Error("no native module"));

    // A failed permission check must not take down the screen that called it.
    await expect(requestPushPermission()).resolves.toBe("denied");
  });
});

describe("registerDeviceToken", () => {
  it("posts the token when permission is held", async () => {
    hasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);

    expect(await registerDeviceToken()).toBe(true);
    expect(api.post).toHaveBeenCalledWith("/api/notifications/device-token", {
      fcmToken: "device-token",
    });
  });

  it("never prompts, and posts nothing, without permission", async () => {
    const alert = jest.spyOn(Alert, "alert");
    hasPermission.mockResolvedValue(AuthorizationStatus.NOT_DETERMINED);

    expect(await registerDeviceToken()).toBe(false);

    // This is what `usePushNotifications` calls on every launch. If it could
    // prompt, the cold-ask bug would simply have moved rather than been fixed.
    expect(alert).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("never throws when the post fails", async () => {
    hasPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);
    api.post.mockRejectedValue(new Error("offline"));

    await expect(registerDeviceToken()).resolves.toBe(false);
  });
});

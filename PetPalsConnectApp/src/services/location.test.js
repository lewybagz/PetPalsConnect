import { Alert } from "react-native";
import * as Location from "expo-location";

import { requestLocationPermission } from "./location";

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

/**
 * The disclosure has to come before the OS prompt, "Not now" has to mean no
 * without asking the OS, and somebody who already answered must not be asked
 * again - those three are what Play's prominent-disclosure rule and common
 * decency both want.
 */
const answer = (label) =>
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    buttons.find((b) => b.text === label).onPress();
  });

beforeEach(() => {
  // restore drops the Alert spy; clear resets the call counts on the
  // module-factory mocks, which restore leaves alone.
  jest.restoreAllMocks();
  jest.clearAllMocks();
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: false,
    status: "undetermined",
    canAskAgain: true,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
});

describe("requestLocationPermission", () => {
  it("explains what other users will see before the OS asks", async () => {
    const alert = answer("Continue");

    expect(await requestLocationPermission()).toBe("granted");

    expect(alert).toHaveBeenCalledTimes(1);
    const [, message, , options] = alert.mock.calls[0];
    expect(message).toMatch(/other users see/i);
    expect(message).toMatch(/approximate/i);
    expect(options).toEqual({ cancelable: false });
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("treats Not now as a refusal without asking the OS", async () => {
    answer("Not now");

    expect(await requestLocationPermission()).toBe("denied");
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("does not explain again to somebody who already said yes", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });
    const alert = jest.spyOn(Alert, "alert");

    expect(await requestLocationPermission()).toBe("granted");
    expect(alert).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("does not nag somebody who said never", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "denied",
      canAskAgain: false,
    });
    const alert = jest.spyOn(Alert, "alert");

    expect(await requestLocationPermission()).toBe("denied");
    expect(alert).not.toHaveBeenCalled();
  });
});

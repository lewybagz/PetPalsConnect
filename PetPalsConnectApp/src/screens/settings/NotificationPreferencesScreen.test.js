import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import NotificationPreferencesScreen from "./NotificationPreferencesScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";

jest.mock("../../api/axios", () => ({ get: jest.fn(), patch: jest.fn() }));

/**
 * The switches.
 *
 * They were `useState` and a comment where the save belongs, so turning
 * notifications off changed a local boolean and told the user it had worked -
 * and the API behind them could not have stored it either.
 */

const CATEGORIES = [
  { key: "messages", label: "Messages" },
  { key: "matches", label: "New matches" },
];

const DEFAULTS = {
  pushNotificationsEnabled: true,
  emailNotificationsEnabled: false,
  messages: true,
  matches: true,
};

const respondWith = (preferences = DEFAULTS) => {
  api.get.mockImplementation((url) => {
    if (url === "/api/userpreferences/categories")
      return Promise.resolve({ data: { categories: CATEGORIES } });
    if (url === "/api/userpreferences/me")
      return Promise.resolve({ data: { notificationPreferences: preferences } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <NotificationPreferencesScreen />
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("NotificationPreferencesScreen", () => {
  it("renders a switch per category the server offers", async () => {
    respondWith();
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("preference-messages")).toBeTruthy());
    expect(screen.getByTestId("preference-matches")).toBeTruthy();
    expect(screen.getByTestId("preference-pushNotificationsEnabled")).toBeTruthy();
  });

  it("flipping a switch saves it", async () => {
    respondWith();
    api.patch.mockResolvedValue({
      data: { notificationPreferences: { ...DEFAULTS, messages: false } },
    });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("preference-messages")).toBeTruthy());
    // A `Switch` answers `valueChange`, not `press`.
    await fireEvent(screen.getByTestId("preference-messages"), "valueChange", false);

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/userpreferences/me", {
        notificationPreferences: { messages: false },
      })
    );
  });

  it("sends only the switch that moved", async () => {
    respondWith();
    api.patch.mockResolvedValue({
      data: { notificationPreferences: { ...DEFAULTS, matches: false } },
    });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("preference-matches")).toBeTruthy());
    await fireEvent(screen.getByTestId("preference-matches"), "valueChange", false);

    // A whole-object write would reset anything this screen has not loaded.
    await waitFor(() =>
      expect(api.patch.mock.calls[0][1]).toEqual({
        notificationPreferences: { matches: false },
      })
    );
  });

  it("a failed save puts the switch back", async () => {
    respondWith();
    api.patch.mockRejectedValue(new Error("offline"));
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("preference-messages")).toBeTruthy());
    await fireEvent(screen.getByTestId("preference-messages"), "valueChange", false);

    // A toggle that stays where it was put while the server disagrees is the
    // lie this screen used to tell.
    await waitFor(() =>
      expect(
        screen.getByTestId("preference-messages").props.accessibilityState.checked
      ).toBe(true)
    );
  });

  it("category switches go dead when the master switch is off", async () => {
    respondWith({ ...DEFAULTS, pushNotificationsEnabled: false });
    await renderScreen();

    await waitFor(() => expect(screen.getByTestId("preference-messages")).toBeTruthy());
    expect(
      screen.getByTestId("preference-messages").props.accessibilityState.disabled
    ).toBe(true);
  });

  it("says so when it cannot load, rather than showing defaults", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText("Couldn't load your settings")).toBeTruthy()
    );
  });
});

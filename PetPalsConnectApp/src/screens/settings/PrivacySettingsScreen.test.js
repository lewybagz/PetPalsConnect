import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import PrivacySettingsScreen from "./PrivacySettingsScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(), patch: jest.fn() }));

/**
 * The screen that used to be entirely fictional.
 *
 * Two switches in `useState` with `// Update location sharing preference in
 * user settings` where the save belongs - and one of them duplicated a switch
 * on the Settings screen that *did* save, so the app held two answers to one
 * question and neither screen knew.
 *
 * So the tests here are about the save, not about the layout: that a control
 * reaches the API, that it sends only what moved, and that it goes back where
 * it was when the server says no.
 */

const SETTINGS = {
  playdateRange: 25,
  locationSharingEnabled: true,
  notificationsEnabled: true,
  units: { distance: "mi", weight: "lb" },
  discovery: {
    minWeight: 0,
    maxWeight: 300,
    minAge: 0,
    maxAge: 30,
    species: [],
    includeUnknownDistance: true,
  },
  privacy: {
    profileVisibility: "everyone",
    messagesFrom: "everyone",
    friendRequestsFrom: "everyone",
    discoverableInSearch: true,
    showOnMap: true,
  },
  choices: {
    units: { distance: ["mi", "km"], weight: ["lb", "kg"] },
    audiences: ["everyone", "matches", "friends"],
    requestAudiences: ["everyone", "friendsOfFriends", "nobody"],
    species: ["dog", "cat", "rabbit", "bird", "other"],
  },
};

const respondWith = (settings = SETTINGS) => {
  api.get.mockResolvedValue({ data: settings });
};

const renderScreen = () =>
  render(
    <AppThemeProvider>
      <SettingsProvider>
        <ToastProvider>
          <PrivacySettingsScreen />
        </ToastProvider>
      </SettingsProvider>
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PrivacySettingsScreen", () => {
  it("shows what each setting currently says", async () => {
    respondWith({
      ...SETTINGS,
      privacy: { ...SETTINGS.privacy, messagesFrom: "friends" },
    });
    await renderScreen();

    const friends = await waitFor(() =>
      screen.getByTestId("privacy-messagesFrom-choice-friends")
    );
    // Selection is carried by state as well as by fill, because a colour is
    // the one signal a person may not receive.
    expect(friends.props.accessibilityState.selected).toBe(true);
    expect(
      screen.getByTestId("privacy-messagesFrom-choice-everyone").props
        .accessibilityState.selected
    ).toBe(false);
  });

  it("narrowing who can message you saves it", async () => {
    respondWith();
    api.patch.mockResolvedValue({
      data: {
        ...SETTINGS,
        privacy: { ...SETTINGS.privacy, messagesFrom: "friends" },
      },
    });
    await renderScreen();

    await fireEvent.press(
      await waitFor(() => screen.getByTestId("privacy-messagesFrom-choice-friends"))
    );

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/users/me/settings", {
        privacy: { messagesFrom: "friends" },
      })
    );
  });

  it("sends only the setting that moved", async () => {
    respondWith();
    api.patch.mockResolvedValue({ data: SETTINGS });
    await renderScreen();

    await fireEvent(
      await waitFor(() => screen.getByTestId("privacy-showOnMap")),
      "valueChange",
      false
    );

    // A whole-subdocument write is the bug the server's flat dotted paths
    // exist to stop; sending one from here would recreate it.
    await waitFor(() =>
      expect(api.patch.mock.calls[0][1]).toEqual({ privacy: { showOnMap: false } })
    );
  });

  it("a failed save puts the switch back", async () => {
    respondWith();
    api.patch.mockRejectedValue(new Error("offline"));
    await renderScreen();

    const row = await waitFor(() => screen.getByTestId("privacy-showOnMap"));
    await fireEvent(row, "valueChange", false);

    await waitFor(() =>
      expect(
        screen.getByTestId("privacy-showOnMap").props.accessibilityState.checked
      ).toBe(true)
    );
  });

  it("offers a way back when the settings will not load", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await renderScreen();

    // A privacy screen that renders defaults it could not read would be
    // claiming the account is more open than anybody knows.
    await waitFor(() => expect(screen.getByText("Try again")).toBeTruthy());
  });
});

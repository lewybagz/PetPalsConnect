import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import DiscoveryPreferencesScreen from "./DiscoveryPreferencesScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(), patch: jest.fn() }));

/**
 * What is in the deck, and what units it is described in.
 *
 * The numbers are stored canonically - miles, pounds, years - and shown in
 * whatever the owner reads, so the interesting assertions here are about the
 * boundary: a slider moved in kilometres has to arrive at the API in miles, and
 * a minimum dragged past its maximum has to be clamped rather than sent.
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

const withSettings = (overrides = {}) => ({
  ...SETTINGS,
  ...overrides,
  discovery: { ...SETTINGS.discovery, ...(overrides.discovery ?? {}) },
  units: { ...SETTINGS.units, ...(overrides.units ?? {}) },
});

const renderScreen = (settings = SETTINGS) => {
  api.get.mockResolvedValue({ data: settings });
  api.patch.mockResolvedValue({ data: settings });

  return render(
    <AppThemeProvider>
      <SettingsProvider>
        <ToastProvider>
          <DiscoveryPreferencesScreen />
        </ToastProvider>
      </SettingsProvider>
    </AppThemeProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DiscoveryPreferencesScreen", () => {
  it("builds its species list from what the server offers", async () => {
    await renderScreen();

    // Not a list typed into the screen: a species the validator accepts and
    // the screen has never heard of is a filter nobody can reach.
    await waitFor(() => expect(screen.getByTestId("discovery-species-dog")).toBeTruthy());
    expect(screen.getByTestId("discovery-species-rabbit")).toBeTruthy();
  });

  it("picking a species saves the whole list, not the one that moved", async () => {
    await renderScreen(withSettings({ discovery: { species: ["dog"] } }));

    await fireEvent.press(
      await waitFor(() => screen.getByTestId("discovery-species-cat"))
    );

    // A list is one value. Sending only "cat" would be read as a replacement
    // and would drop the dogs.
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/users/me/settings", {
        discovery: { species: ["dog", "cat"] },
      })
    );
  });

  it("a range set in kilometres is stored in miles", async () => {
    await renderScreen(withSettings({ units: { distance: "km" } }));

    const slider = await waitFor(() => screen.getByTestId("discovery-playdateRange"));
    await fireEvent(slider, "slidingComplete", 80);

    await waitFor(() => {
      const [, body] = api.patch.mock.calls.at(-1);
      // 80 km is a little under 50 miles. Storage is canonical because
      // matching compares two numbers, and a stored unit would make two pets
      // incomparable if their owners had chosen differently.
      expect(body.playdateRange).toBeCloseTo(49.71, 1);
    });
  });

  it("a minimum dragged past its maximum is clamped, not sent", async () => {
    await renderScreen(withSettings({ discovery: { minWeight: 0, maxWeight: 40 } }));

    const slider = await waitFor(() => screen.getByTestId("discovery-minWeight"));
    await fireEvent(slider, "slidingComplete", 200);

    // An impossible range matches nothing, and an empty deck looks exactly
    // like a broken one. The server refuses it too; this stops it being asked.
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/users/me/settings", {
        discovery: { minWeight: 40 },
      })
    );
  });

  it("switching units saves the preference", async () => {
    await renderScreen();

    await fireEvent.press(await waitFor(() => screen.getByTestId("units-weight-kg")));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/users/me/settings", {
        units: { weight: "kg" },
      })
    );
  });

  it("says 'Any' rather than a range when nothing is narrowed", async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getAllByText("Any").length).toBeGreaterThan(0));
  });
});

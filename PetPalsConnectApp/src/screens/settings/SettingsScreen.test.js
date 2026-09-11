import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import SettingsScreen from "./SettingsScreen";
import api from "../../api/axios";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { AuthSessionContext } from "../../context/AuthSessionContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(), patch: jest.fn(), post: jest.fn() }));
jest.mock("@react-native-firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: "u1", email: "bo@example.test" } }),
  signOut: jest.fn(() => Promise.resolve()),
}));

/**
 * The hub, which no longer holds any setting that has a home of its own.
 *
 * It used to be twenty-one identical bordered boxes, so "Privacy Settings" and
 * "Sign Out" looked the same and nothing said what any of them was set to. Two
 * of the switches on it also duplicated ones on the screens it linked to, with
 * a different answer.
 *
 * What is worth asserting is therefore what it *says*: that each row shows the
 * current answer, and that every row goes where it claims.
 */

const SETTINGS = {
  playdateRange: 40,
  locationSharingEnabled: true,
  notificationsEnabled: true,
  units: { distance: "mi", weight: "lb" },
  discovery: {},
  privacy: {},
  choices: {},
};

const session = {
  status: "ready",
  isSignedIn: true,
  profile: { _id: "u1", username: "bo", subscribed: false },
  hasPet: true,
  deleteAccount: jest.fn(),
};

const renderScreen = (navigation, settings = SETTINGS) => {
  api.get.mockResolvedValue({ data: settings });

  return render(
    <AppThemeProvider>
      <AuthSessionContext.Provider value={session}>
        <SettingsProvider>
          <ToastProvider>
            <SettingsScreen navigation={navigation} />
          </ToastProvider>
        </SettingsProvider>
      </AuthSessionContext.Provider>
    </AppThemeProvider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SettingsScreen", () => {
  it("shows the current answer beside the row that owns it", async () => {
    await renderScreen({ navigate: jest.fn() });

    // A hub row with no value is a row you have to open to find out anything.
    await waitFor(() => expect(screen.getByText("40 miles")).toBeTruthy());
    expect(screen.getByText("@bo")).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("reads the range in the owner's own units", async () => {
    await renderScreen(
      { navigate: jest.fn() },
      { ...SETTINGS, units: { distance: "km", weight: "kg" } }
    );

    // 40 miles is a little over 64 km. The stored number never changes.
    await waitFor(() => expect(screen.getByText("64 km")).toBeTruthy());
  });

  it("every row goes where it says", async () => {
    const navigate = jest.fn();
    await renderScreen({ navigate });

    const routes = {
      "settings-discovery": "DiscoveryPreferences",
      "settings-privacy": "PrivacySettings",
      "settings-blocked-accounts": "BlockedAccounts",
      "settings-security": "SecuritySettings",
      "settings-notifications": "NotificationPreferences",
      "settings-display": "DisplaySettings",
      "settings-account-information": "AccountInformation",
      "settings-subscription": "SubscriptionManagement",
    };

    for (const [testID, route] of Object.entries(routes)) {
      await fireEvent.press(await waitFor(() => screen.getByTestId(testID)));
      expect(navigate).toHaveBeenCalledWith(route);
    }
  });

  it("no longer holds a setting that lives on another screen", async () => {
    await renderScreen({ navigate: jest.fn() });

    await waitFor(() => expect(screen.getByTestId("settings-privacy")).toBeTruthy());
    // The location switch here and the one on the Privacy screen were two
    // answers to one question, and only one of them saved.
    expect(screen.queryByText("Share My Location On The PetPalsMap")).toBeNull();
    expect(screen.queryByText("Dark Mode")).toBeNull();
  });
});

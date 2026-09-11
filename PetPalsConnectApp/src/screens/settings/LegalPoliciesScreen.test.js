import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import LegalPoliciesScreen from "./LegalPoliciesScreen";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";
import { PRIVACY_URL, TERMS_URL } from "../../config/legal";

/**
 * The screen is two links. What matters is that each opens the hosted
 * document - the one the store listings cite - rather than a copy or a
 * placeholder, and that a browser that refuses says so instead of nothing.
 */
const renderScreen = () =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <LegalPoliciesScreen />
      </ToastProvider>
    </AppThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  Linking.openURL.mockResolvedValue(true);
});

describe("LegalPoliciesScreen", () => {
  it("opens the hosted privacy policy and terms", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("legal-privacy"));
    expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_URL);

    await fireEvent.press(screen.getByTestId("legal-terms"));
    expect(Linking.openURL).toHaveBeenCalledWith(TERMS_URL);
  });

  it("points at https pages on the repo's Pages site, not placeholders", async () => {
    await renderScreen();
    for (const url of [PRIVACY_URL, TERMS_URL]) {
      expect(url).toMatch(/^https:\/\/lewybagz\.github\.io\/PetPalsConnect\/\w+\.html$/);
    }
    expect(screen.queryByText(/content here/i)).toBeNull();
  });

  it("says so when the page cannot be opened", async () => {
    Linking.openURL.mockRejectedValueOnce(new Error("no browser"));
    await renderScreen();

    await fireEvent.press(screen.getByTestId("legal-privacy"));

    expect(await screen.findByText(/couldn't open/i)).toBeTruthy();
  });
});

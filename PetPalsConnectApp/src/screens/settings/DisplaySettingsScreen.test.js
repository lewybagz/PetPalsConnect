import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import DisplaySettingsScreen from "./DisplaySettingsScreen";
import DiscoverPreview from "./displayPreview.testHelper";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { DevicePreferencesProvider } from "../../context/DevicePreferencesContext";

/**
 * Three device settings, and the promise that each one changes something.
 *
 * This is the file the comment in `DevicePreferencesContext` points at. A
 * haptics switch and an autoplay switch were both drafted and both cut, because
 * neither had anything to switch - and a settings screen full of controls that
 * store a value nothing reads is the same failure as blocking being a model
 * nothing queried, dressed up as generosity.
 *
 * So each test here flips a switch and then asserts on something *else*: the
 * theme the tree resolves, the font size `Text` renders at, whether the deck
 * draws its score.
 */

const renderScreen = (children = null) =>
  render(
    <AppThemeProvider>
      <DevicePreferencesProvider>
        <DisplaySettingsScreen />
        {children}
      </DevicePreferencesProvider>
    </AppThemeProvider>
  );

describe("DisplaySettingsScreen", () => {
  it("offers three themes, not a two-state dark mode switch", async () => {
    await renderScreen();

    // "System" is the option most people want and the one a boolean cannot
    // express, which is what the old "Dark Mode" toggle was missing.
    expect(screen.getByTestId("theme-choice-system")).toBeTruthy();
    expect(screen.getByTestId("theme-choice-light")).toBeTruthy();
    expect(screen.getByTestId("theme-choice-dark")).toBeTruthy();
    expect(
      screen.getByTestId("theme-choice-system").props.accessibilityState.selected
    ).toBe(true);
  });

  it("choosing a theme selects it", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("theme-choice-dark"));

    await waitFor(() =>
      expect(
        screen.getByTestId("theme-choice-dark").props.accessibilityState.selected
      ).toBe(true)
    );
  });

  it("larger text actually enlarges text", async () => {
    await renderScreen(<DiscoverPreview />);

    const before = screen.getByTestId("preview-body").props.style;
    await fireEvent(screen.getByTestId("display-largerText"), "valueChange", true);

    await waitFor(() => {
      const after = screen.getByTestId("preview-body").props.style;
      // Flattened by the renderer into one object per style entry; the size
      // lives in the second, which is where `Text` puts the role's metrics.
      expect(sizeOf(after)).toBeGreaterThan(sizeOf(before));
    });
  });

  it("turning the match score off hides it", async () => {
    await renderScreen(<DiscoverPreview />);

    expect(screen.queryByTestId("preview-score")).toBeTruthy();
    await fireEvent(screen.getByTestId("display-showMatchScore"), "valueChange", false);

    await waitFor(() => expect(screen.queryByTestId("preview-score")).toBeNull());
  });

  it("reset puts everything back", async () => {
    await renderScreen(<DiscoverPreview />);

    await fireEvent(screen.getByTestId("display-showMatchScore"), "valueChange", false);
    await waitFor(() => expect(screen.queryByTestId("preview-score")).toBeNull());

    await fireEvent.press(screen.getByTestId("display-reset"));

    await waitFor(() => expect(screen.queryByTestId("preview-score")).toBeTruthy());
  });
});

/** The `fontSize` out of whatever shape the style prop arrived in. */
const sizeOf = (style) =>
  (Array.isArray(style) ? style : [style])
    .flat(Infinity)
    .map((entry) => entry?.fontSize)
    .find((size) => typeof size === "number");

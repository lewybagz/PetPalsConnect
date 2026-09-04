import React from "react";
import { render, screen } from "@testing-library/react-native";

import OnboardingProgress, { ONBOARDING_STEPS } from "./OnboardingProgress";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { light } from "../../styles/tokens";

/**
 * Signing up is three writes that cannot be made atomic - the Firebase account,
 * the Mongo profile, the first pet - and every screen arrived with no
 * indication that it was one of three or which one. Somebody interrupted after
 * the second had no way to tell whether they had finished.
 */

const wrap = (ui) => render(<AppThemeProvider>{ui}</AppThemeProvider>);

const flatten = (style) =>
  Array.isArray(style)
    ? style.filter(Boolean).reduce((all, one) => ({ ...all, ...flatten(one) }), {})
    : (style ?? {});

describe("OnboardingProgress", () => {
  it("says which step this is and how many there are", async () => {
    await wrap(<OnboardingProgress step={2} />);

    expect(screen.getByText(/Step 2 of 3/)).toBeTruthy();
    expect(screen.getByText(/Profile/)).toBeTruthy();
  });

  it("fills the bars up to the current step and no further", async () => {
    await wrap(<OnboardingProgress step={2} />);

    const filled = (index) =>
      flatten(screen.getByTestId(`onboarding-progress-bar-${index}`).props.style)
        .backgroundColor;

    expect(filled(1)).toBe(light.primary);
    expect(filled(2)).toBe(light.primary);
    expect(filled(3)).toBe(light.surfaceAlt);
  });

  it("announces itself as progress, with a value a screen reader can read", async () => {
    await wrap(<OnboardingProgress step={3} />);

    const bar = screen.getByTestId("onboarding-progress");
    expect(bar.props.accessibilityRole).toBe("progressbar");
    expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 3 });
    expect(bar.props.accessibilityLabel).toBe("Step 3 of 3: Your pet");
  });

  it("clamps a step outside the range rather than rendering nothing", async () => {
    await wrap(<OnboardingProgress step={9} />);

    expect(screen.getByText(/Step 3 of 3/)).toBeTruthy();
  });

  it("has a label for every step it can be on", () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
    for (const label of ONBOARDING_STEPS) {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

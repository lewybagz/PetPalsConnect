import React from "react";
import { Pressable, Text as RNText, View } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";

import SwipeableCard from "./SwipeableCard";
import { MAX_ROTATION } from "./swipeDecision";
import { AppThemeProvider } from "../../context/AppThemeContext";

/**
 * The gesture wrapper.
 *
 * A pan cannot be simulated here - RTL has no gesture driver and the handlers
 * run on the UI thread - so the thresholds are tested as pure functions in
 * `swipeDecision.test.js`. What is left for this file is everything the
 * wrapper could break by existing: whether the card still renders, whether the
 * controls inside it can still be tapped, and whether the stamps are present
 * to be animated.
 *
 * The tap case is the one that matters. `Gesture.Pan` claims the touch as soon
 * as it activates, so without `activeOffsetX` the wrapper would swallow every
 * press on "See full profile" and the safety menu, both of which live inside
 * the card - and nothing else in the suite would notice.
 */

const renderCard = (props = {}) =>
  render(
    <AppThemeProvider>
      <SwipeableCard testID="card" {...props}>
        <View>
          <RNText>Bo</RNText>
        </View>
      </SwipeableCard>
    </AppThemeProvider>
  );

describe("SwipeableCard", () => {
  it("renders the card it wraps", async () => {
    await renderCard();

    expect(screen.getByTestId("card")).toBeTruthy();
    expect(screen.getByText("Bo")).toBeTruthy();
  });

  it("carries both stamps, so a drag has something to reveal", async () => {
    await renderCard();

    expect(screen.getByTestId("swipe-stamp-like")).toBeTruthy();
    expect(screen.getByTestId("swipe-stamp-pass")).toBeTruthy();
  });

  it("does not swallow taps on the controls inside it", async () => {
    const onPress = jest.fn();

    await render(
      <AppThemeProvider>
        <SwipeableCard testID="card">
          <Pressable testID="inner" onPress={onPress}>
            <RNText>See full profile</RNText>
          </Pressable>
        </SwipeableCard>
      </AppThemeProvider>
    );

    await fireEvent.press(screen.getByTestId("inner"));

    expect(onPress).toHaveBeenCalled();
  });

  it("still renders when the gesture is switched off", async () => {
    // Preview mode browses rather than decides, so the card is inert - but it
    // is still the thing on screen.
    await renderCard({ enabled: false });

    expect(screen.getByTestId("card")).toBeTruthy();
    expect(screen.getByText("Bo")).toBeTruthy();
  });

  it("renders without an onDecide, rather than throwing on release", async () => {
    await renderCard({ onDecide: undefined });

    expect(screen.getByTestId("card")).toBeTruthy();
  });

  /**
   * The resting appearance is real here, even though nothing animates: the
   * Reanimated double in `jest.setup.js` runs `useAnimatedStyle` once and
   * returns a plain style object. So the transform and the stamp opacities
   * that a screenshot shows can be asserted rather than eyeballed.
   */
  describe("what the card looks like at a given displacement", () => {
    const styleOf = (node) =>
      Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

    const transformOf = (node) => {
      const { transform } = styleOf(node);
      return Object.assign({}, ...transform);
    };

    it("sits square and unstamped at rest", async () => {
      await renderCard();

      const transform = transformOf(screen.getByTestId("card"));
      expect(transform.translateX).toBe(0);
      expect(transform.rotate).toBe("0deg");

      expect(styleOf(screen.getByTestId("swipe-stamp-like")).opacity).toBe(0);
      expect(styleOf(screen.getByTestId("swipe-stamp-pass")).opacity).toBe(0);
    });

    it("leans and stamps when it is thrown right", async () => {
      await renderCard({ previewTranslateX: 140 });

      const transform = transformOf(screen.getByTestId("card"));
      expect(transform.translateX).toBe(140);
      // Leaning, and the right way.
      expect(parseFloat(transform.rotate)).toBeGreaterThan(0);

      expect(styleOf(screen.getByTestId("swipe-stamp-like")).opacity).toBeGreaterThan(0);
      // Only one stamp is ever visible: showing both would say nothing.
      expect(styleOf(screen.getByTestId("swipe-stamp-pass")).opacity).toBe(0);
    });

    it("leans and stamps the other way when it is thrown left", async () => {
      await renderCard({ previewTranslateX: -140 });

      expect(parseFloat(transformOf(screen.getByTestId("card")).rotate)).toBeLessThan(0);

      expect(styleOf(screen.getByTestId("swipe-stamp-pass")).opacity).toBeGreaterThan(0);
      expect(styleOf(screen.getByTestId("swipe-stamp-like")).opacity).toBe(0);
    });

    it("never leans past the maximum, however far it is thrown", async () => {
      await renderCard({ previewTranslateX: 5000 });

      // A card thrown clear of the screen should not spin.
      expect(parseFloat(transformOf(screen.getByTestId("card")).rotate)).toBe(
        MAX_ROTATION
      );
      expect(styleOf(screen.getByTestId("swipe-stamp-like")).opacity).toBe(1);
    });
  });

  it("the stamps do not intercept touches meant for the card", async () => {
    const onPress = jest.fn();

    await render(
      <AppThemeProvider>
        <SwipeableCard testID="card">
          <Pressable testID="inner" onPress={onPress}>
            <RNText>Tap me</RNText>
          </Pressable>
        </SwipeableCard>
      </AppThemeProvider>
    );

    // The stamps sit in an absolutely-positioned overlay across the whole
    // card. Without `pointerEvents="none"` they would cover it completely.
    expect(screen.getByTestId("swipe-stamp-like").props.pointerEvents).toBe("none");
    await fireEvent.press(screen.getByTestId("inner"));
    expect(onPress).toHaveBeenCalled();
  });
});

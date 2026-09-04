import React, { useCallback } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Text } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { radius } from "../../styles/tokens";
import {
  decisionFor,
  rotationFor,
  stampOpacity,
} from "./swipeDecision";

/**
 * The deck's top card, draggable.
 *
 * Discovery has always decided by two buttons under the card. That works, and
 * it is what a screen reader and switch control use, but it is not what this
 * kind of app *is*: the gesture is the product, and the README has listed its
 * absence as a known gap since the rewrite began.
 *
 * Three things this deliberately does not do:
 *
 * - It does not decide anything itself. `onDecide` is the screen's existing
 *   `submit`, which advances the deck optimistically, shows the match modal on
 *   a mutual, and rolls the index back with a toast on failure. A gesture
 *   handler with its own copy of that would be a second place to forget the
 *   rollback - the same reason discovery and its preview mode share
 *   `reachableCandidates` on the server.
 * - It does not replace the buttons. WCAG 2.5.1 requires a single-pointer
 *   alternative to any path-based gesture, and a drag is unavailable to
 *   VoiceOver and switch control regardless. The buttons are the interface;
 *   this is a faster way to reach it.
 * - It does not own the thresholds. Those are pure functions in
 *   `swipeDecision.js`, because a pan cannot be simulated in a test and rules
 *   buried in `onEnd` would never be checked.
 */

/** How far off-screen a committed card flies, as a multiple of the width. */
const THROW_DISTANCE = 1.4;

/** Vertical drag is followed, softly - a card that only slides feels rigid. */
const VERTICAL_DAMPING = 0.25;

const Stamp = ({ tailwind, style, tone, label, testID }) => (
  <Animated.View
    testID={testID}
    pointerEvents="none"
    style={[
      tailwind(
        `absolute top-xxl ${tone === "like" ? "left-lg" : "right-lg"} px-md py-sm`
      ),
      {
        borderWidth: 3,
        borderRadius: radius.control,
        transform: [{ rotate: tone === "like" ? "-12deg" : "12deg" }],
      },
      tailwind(tone === "like" ? "border-success" : "border-danger"),
      style,
    ]}
  >
    <Text variant="title" tone={tone === "like" ? "success" : "danger"}>
      {label}
    </Text>
  </Animated.View>
);

const SwipeableCard = ({
  children,
  onDecide,
  enabled = true,
  testID,
  /**
   * Where the card sits before anybody touches it. Zero in the app.
   *
   * The gallery renders real screens in a headless browser, which cannot pan -
   * so without a way to seed a displacement, the lean and the two stamps would
   * be the one part of this screen nobody ever looks at. They are also the part
   * that is hardest to get right by reading, which is the whole argument for
   * having a gallery.
   */
  previewTranslateX = 0,
}) => {
  const tailwind = useTailwind();
  const { width } = useWindowDimensions();

  const translateX = useSharedValue(previewTranslateX);
  const translateY = useSharedValue(0);

  /**
   * Hands the decision to the screen, with the card already back at centre.
   *
   * The reset has to happen before `onDecide`, not after: the screen advances
   * its index synchronously, so a card left at its thrown-off position would
   * render the *next* pet mid-flight for a frame before springing back.
   */
  const commit = useCallback(
    (decision) => {
      translateX.value = 0;
      translateY.value = 0;
      onDecide?.(decision);
    },
    [onDecide, translateX, translateY]
  );

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Only claim the gesture once it is clearly horizontal. Without this the
    // pan swallows taps on "See full profile" and the safety menu, both of
    // which live inside the card.
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * VERTICAL_DAMPING;
    })
    .onEnd((event) => {
      const decision = decisionFor({
        translationX: event.translationX,
        velocityX: event.velocityX,
        width,
      });

      if (!decision) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        return;
      }

      // Throw it clear before committing, so the card leaves rather than
      // vanishing - the animation is what says which way the decision went.
      const target = (decision === "like" ? 1 : -1) * width * THROW_DISTANCE;
      translateX.value = withTiming(target, { duration: 180 }, (finished) => {
        if (finished) runOnJS(commit)(decision);
      });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotationFor(translateX.value, width)}deg` },
    ],
  }));

  // Two stamps rather than one that changes colour: a single node would have to
  // re-read its label from the UI thread, and each is only ever visible in one
  // direction anyway.
  const likeStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? stampOpacity(translateX.value, width) : 0,
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? stampOpacity(translateX.value, width) : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID={testID} style={[tailwind("flex-1"), cardStyle]}>
        {children}

        {/* Inside the card so they travel and lean with it. */}
        <View pointerEvents="none" style={tailwind("absolute inset-0")}>
          <Stamp
            testID="swipe-stamp-like"
            tailwind={tailwind}
            style={likeStyle}
            tone="like"
            label="LIKE"
          />
          <Stamp
            testID="swipe-stamp-pass"
            tailwind={tailwind}
            style={passStyle}
            tone="pass"
            label="NOPE"
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default SwipeableCard;

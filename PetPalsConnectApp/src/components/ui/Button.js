import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit, type } from "../../styles/tokens";

/**
 * The button.
 *
 * `AnimatedButton` put its padding and background on an outer `Animated.View`
 * and `onPress` on a bare `TouchableOpacity` *inside* it, which had no padding
 * of its own. Taps landing in the visible blue did nothing at all; the real
 * target was the text box, roughly 20pt tall. Apple asks 44pt, Material 48dp,
 * WCAG 2.2 SC 2.5.8 24x24px - it missed all three, invisibly, because the
 * button looked the right size. Its press animation ran from `onTouchStart` on
 * the wrapper while the press was handled by a child, which is why the
 * animation and the action could disagree.
 *
 * So: one node owns the padding, the background, the press and the minimum
 * height. There is nowhere left for them to come apart.
 */

const VARIANTS = {
  primary: {
    container: "bg-primary",
    label: "text-onPrimary",
    spinner: "onPrimary",
  },
  secondary: {
    container: "bg-surface border border-borderStrong",
    label: "text-text",
    spinner: "text",
  },
  soft: {
    container: "bg-primarySoft",
    label: "text-primary",
    spinner: "primary",
  },
  danger: {
    container: "bg-danger",
    label: "text-onPrimary",
    spinner: "onPrimary",
  },
  ghost: {
    container: "bg-transparent",
    label: "text-primary",
    spinner: "primary",
  },
  /**
   * Destructive, but not the primary action on the screen.
   *
   * A filled danger button is the loudest thing wherever it sits, which is
   * wrong for a last resort offered beside something constructive - on the
   * suspended screen it outshouted "Ask for a review". Settings was already
   * hand-rolling this exact treatment with a border and `text-danger`.
   */
  dangerOutline: {
    container: "bg-transparent border border-danger",
    label: "text-danger",
    spinner: "danger",
  },
};

const SIZES = {
  // Never below the tap-target floor, whatever the padding says.
  md: { padding: "px-lg py-md", minHeight: hit.min, text: type.body },
  lg: { padding: "px-xl py-lg", minHeight: 52, text: type.body },
};

const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon = null,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const look = VARIANTS[variant] ?? VARIANTS.primary;
  const scale = SIZES[size] ?? SIZES.md;
  const inert = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={inert ? undefined : onPress}
      disabled={inert}
      // Icon-only controls announce as nothing without this. 374 touchables in
      // this app carried two accessibility labels between them.
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        tailwind(
          `flex-row items-center justify-center rounded-control ${scale.padding} ${look.container} ${
            fullWidth ? "w-full" : ""
          }`
        ),
        {
          minHeight: scale.minHeight,
          // Dimming is the *disabled* treatment: it says "not available". A
          // button that is working is available - it just is not finished - so
          // it stays at full strength, or the screenshot of a busy form looks
          // like a screenshot of a broken one.
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator testID={testID ? `${testID}-spinner` : undefined} color={tokens[look.spinner]} />
      ) : (
        <>
          {icon ? <View style={tailwind("mr-sm")}>{icon}</View> : null}
          {title ? (
            <Text
              style={[
                tailwind(look.label),
                { fontSize: scale.text.fontSize, fontWeight: "600" },
              ]}
              // Dynamic Type still scales, but a button that grows without
              // limit pushes its own row off the screen.
              maxFontSizeMultiplier={scale.text.maxScale}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
};

export default Button;

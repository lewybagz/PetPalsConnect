import React from "react";
import { Pressable, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";

/**
 * The raised plane everything sits on.
 *
 * The same card shadow was re-typed in a dozen files with slightly different
 * opacity, offset and radius, because there was no `Card` to reach for - the 25
 * files in `src/components` are almost all feature cards
 * (`PlaydateCardComponent`, `ChatCardComponent`) rather than primitives.
 *
 * A border rather than a shadow: shadows need a different recipe per platform
 * and disappear entirely against a dark background, which is where half of this
 * app is about to live.
 */
const Card = ({ children, onPress, padded = true, style, testID, ...rest }) => {
  const tailwind = useTailwind();

  const look = [
    tailwind(`bg-surface rounded-card border border-border ${padded ? "p-lg" : ""}`),
    style,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={look} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [...look, pressed ? { opacity: 0.9 } : null]}
      {...rest}
    >
      {children}
    </Pressable>
  );
};

export default Card;

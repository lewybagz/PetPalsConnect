import React from "react";
import { Pressable, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { useTokens } from "../context/AppThemeContext";

/**
 * Replaces `react-native-star-rating`, which was last published in 2019 and does
 * not work with modern React Native. Same props the screens already pass.
 */
export default function StarRating({
  rating = 0,
  maxStars = 5,
  starSize = 32,
  // A default cannot read a hook, so the colour is resolved in the body and a
  // caller's override still wins. Passing the literals as defaults meant a gold
  // star that stayed gold on a dark background.
  fullStarColor,
  emptyStarColor,
  disabled = false,
  selectedStar,
  containerStyle,
}) {
  const tokens = useTokens();
  const full = fullStarColor ?? tokens.warning;
  const empty = emptyStarColor ?? tokens.textFaint;

  return (
    <View style={[{ flexDirection: "row" }, containerStyle]}>
      {Array.from({ length: maxStars }, (_, index) => {
        const value = index + 1;
        const filled = value <= rating;
        return (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => selectedStar?.(value)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${value} out of ${maxStars} stars`}
            style={{ paddingHorizontal: 2 }}
          >
            <FontAwesome
              name={filled ? "star" : "star-o"}
              size={starSize}
              color={filled ? full : empty}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

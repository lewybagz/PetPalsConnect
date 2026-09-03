import React from "react";
import { Pressable, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

/**
 * Replaces `react-native-star-rating`, which was last published in 2019 and does
 * not work with modern React Native. Same props the screens already pass.
 */
export default function StarRating({
  rating = 0,
  maxStars = 5,
  starSize = 32,
  fullStarColor = "#f1c40f",
  emptyStarColor = "#c8c8c8",
  disabled = false,
  selectedStar,
  containerStyle,
}) {
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
              color={filled ? fullStarColor : emptyStarColor}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

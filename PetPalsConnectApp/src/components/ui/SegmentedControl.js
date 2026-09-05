import React from "react";
import { Pressable, View } from "react-native";

import { useTailwind } from "../../styles/tailwind";
import { hit } from "../../styles/tokens";
import Text from "./Text";

/**
 * A choice between two to four options, all of them visible.
 *
 * Settings screens reached for `Picker` from `react-native` - a component
 * removed from core in 0.62, five years and twenty-four releases before the
 * version this app runs, so `SecuritySettingsScreen` was importing `undefined`
 * and rendering it. What replaced it in the ecosystem is a wheel or a modal,
 * both of which hide the alternatives behind a tap.
 *
 * For "who can message you: everyone / matches / friends" the alternatives
 * *are* the explanation. Showing all three is what makes the setting
 * understandable without a paragraph.
 *
 * Selection is carried by fill *and* by weight, not by fill alone: a colour is
 * the one signal a person with a colour-vision difference may not receive, and
 * `accessibilityState.selected` covers the screen reader.
 */
const SegmentedControl = ({
  options,
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
  testID,
}) => {
  const tailwind = useTailwind();

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={tailwind(
        `flex-row bg-surfaceAlt rounded-control p-xs ${disabled ? "opacity-50" : ""}`
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              tailwind(
                `flex-1 items-center justify-center rounded-control px-sm ${
                  selected ? "bg-surface border border-borderStrong" : ""
                }`
              ),
              // The whole control is one row of targets, so the height floor
              // belongs to each segment rather than to the container.
              { minHeight: hit.min - 8, opacity: pressed && !selected ? 0.6 : 1 },
            ]}
          >
            <Text
              variant="label"
              align="center"
              tone={selected ? "default" : "muted"}
              weight={selected ? "700" : "500"}
              numberOfLines={2}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default SegmentedControl;

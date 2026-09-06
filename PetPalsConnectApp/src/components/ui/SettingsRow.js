import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit } from "../../styles/tokens";
import Text from "./Text";
import Toggle from "./Toggle";

/**
 * One row of a settings screen.
 *
 * Every settings screen in the app built its own out of a `TouchableOpacity`, a
 * `View` and a bordered box - `my-2 p-2 border rounded border-border`, retyped
 * eleven times on the Settings screen alone, each one a 34pt tap target with no
 * chevron, no current value and no room for a word of explanation. A setting
 * whose effect is not obvious needs a sentence next to it, and there was
 * nowhere to put one.
 *
 * Three shapes, because that is what a settings screen actually contains:
 *
 * - `to`/`onPress` - navigates. Shows its current value and a chevron.
 * - `value`/`onValueChange` - a switch. The whole row toggles it, so the tap
 *   target is the row rather than the 51x31 switch.
 * - `children` - anything else (a slider, a segmented control) under the label.
 *
 * The row is `hit.min` tall in all three, which the hand-rolled ones were not.
 */
const SettingsRow = ({
  label,
  description,
  /** Right-hand text for a navigating row: the setting's current answer. */
  detail,
  icon,
  onPress,
  value,
  onValueChange,
  disabled = false,
  destructive = false,
  children,
  testID,
}) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const isSwitch = typeof onValueChange === "function";
  const pressable = Boolean(onPress) || isSwitch;
  const tone = destructive ? "danger" : disabled ? "faint" : "default";

  const body = (
    <View style={tailwind("flex-row items-center px-lg py-md")}>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? tokens.danger : tokens.textMuted}
          style={tailwind("mr-md")}
        />
      ) : null}

      <View style={tailwind("flex-1 pr-md")}>
        <Text variant="body" tone={tone}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
            {description}
          </Text>
        ) : null}
      </View>

      {detail ? (
        <Text variant="body" tone="muted" style={tailwind("mr-sm")}>
          {detail}
        </Text>
      ) : null}

      {isSwitch ? (
        <Toggle
          testID={testID ? `${testID}-switch` : undefined}
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
        />
      ) : null}

      {onPress && !isSwitch ? (
        <Ionicons name="chevron-forward" size={18} color={tokens.textFaint} />
      ) : null}
    </View>
  );

  const content = children ? (
    <View>
      {body}
      <View style={tailwind("px-lg pb-md")}>{children}</View>
    </View>
  ) : (
    body
  );

  if (!pressable) {
    return (
      <View testID={testID} style={{ minHeight: children ? undefined : hit.min }}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      // A switch row announces itself as a switch, so a screen reader offers
      // "toggle" rather than "activate" - and reads its state.
      accessibilityRole={isSwitch ? "switch" : "button"}
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ disabled, ...(isSwitch ? { checked: Boolean(value) } : {}) }}
      disabled={disabled}
      onPress={isSwitch ? () => onValueChange(!value) : onPress}
      style={({ pressed }) => [
        { minHeight: children ? undefined : hit.min, opacity: disabled ? 0.5 : 1 },
        pressed ? tailwind("bg-surfaceAlt") : null,
      ]}
    >
      {content}
    </Pressable>
  );
};

export default SettingsRow;

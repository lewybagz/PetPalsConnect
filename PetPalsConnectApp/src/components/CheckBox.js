import React from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * Replaces the CheckBox from `react-native-elements`, which is unmaintained and
 * was the only thing that package was used for.
 */
export default function CheckBox({
  title,
  checked = false,
  onPress,
  disabled = false,
  containerStyle,
  textStyle,
  checkedColor = "tomato",
  uncheckedColor = "#888",
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[
        { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
        containerStyle,
      ]}
    >
      <MaterialCommunityIcons
        name={checked ? "checkbox-marked" : "checkbox-blank-outline"}
        size={24}
        color={checked ? checkedColor : uncheckedColor}
      />
      {title ? (
        <Text style={[{ marginLeft: 8, fontSize: 16 }, textStyle]}>{title}</Text>
      ) : (
        <View />
      )}
    </Pressable>
  );
}

export { CheckBox };

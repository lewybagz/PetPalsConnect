import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Text } from "../ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { hit, radius, space } from "../../styles/tokens";
import { useSpotEnabled } from "../../hooks/useSpotEnabled";

/**
 * The way into Spot from the screens where a question is most likely.
 *
 * One component, two shapes. Floating: a pill at the bottom right, above the
 * safe area, for screens that are a `Screen` wrapping a `ScrollView` (weight,
 * the missing-pet checklist, a pet's page). Inline: an ordinary soft button
 * at the end of the content, for screens whose scroll view *is* the screen
 * (health records, an article) and for the toxin lookup, where nothing may
 * float over the numbers.
 *
 * `context` travels with the first message - "asked from Bella's health
 * screen" - so Spot already knows what the question is about. Nothing
 * renders until the server has said Spot is on; off is an ordinary state.
 */
const AskSpotButton = ({
  navigation,
  context = null,
  prefill,
  inline = false,
  label = "Ask Spot",
  testID = "ask-spot",
}) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const enabled = useSpotEnabled();

  if (!enabled) return null;

  // Literal keys, so `navigation.test.js` can see the params the screen reads.
  const open = () =>
    navigation.navigate("Spot", { context: context ?? undefined, prefill: prefill ?? undefined });

  if (inline) {
    return (
      <Button
        title={label}
        variant="soft"
        testID={testID}
        onPress={open}
        icon={<Ionicons name="sparkles-outline" size={18} color={tokens.primary} />}
        accessibilityLabel={`${label} about this`}
        style={tailwind("mt-lg")}
      />
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} about this`}
      onPress={open}
      style={({ pressed }) => [
        tailwind("flex-row items-center bg-primary px-lg"),
        {
          position: "absolute",
          right: space.lg,
          bottom: space.lg + insets.bottom,
          minHeight: hit.min,
          borderRadius: radius.pill,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name="sparkles-outline" size={18} color={tokens.onPrimary} />
      <Text weight="600" style={tailwind("ml-xs text-onPrimary")}>
        {label}
      </Text>
    </Pressable>
  );
};

export default AskSpotButton;

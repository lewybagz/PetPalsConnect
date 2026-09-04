import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import Button from "./Button";
import Text from "./Text";

/**
 * One visual language for "nothing here yet".
 *
 * Every list in the app invented its own: a centred `Text`, a paw icon and a
 * sentence, or nothing at all. An empty state is the screen a new user sees
 * most - the deck before matching, the inbox before a first message - so it is
 * worth being one component rather than eleven approximations.
 */
const EmptyState = ({
  icon = "paw-outline",
  title,
  message,
  actionLabel,
  onAction,
  testID = "empty-state",
}) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  return (
    <View
      testID={testID}
      style={tailwind("flex-1 items-center justify-center px-xl py-xxl")}
    >
      <Ionicons name={icon} size={52} color={tokens.textFaint} />

      {title ? (
        <Text variant="title" align="center" style={tailwind("mt-lg")}>
          {title}
        </Text>
      ) : null}

      {message ? (
        <Text variant="body" tone="muted" align="center" style={tailwind("mt-sm")}>
          {message}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          testID={`${testID}-action`}
          title={actionLabel}
          onPress={onAction}
          fullWidth={false}
          style={tailwind("mt-xl px-xl")}
        />
      ) : null}
    </View>
  );
};

export default EmptyState;

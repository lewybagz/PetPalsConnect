import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button, Card, Text } from "../ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";

/**
 * Today's Spot messages are used up.
 *
 * A card in the transcript rather than a toast: it is the answer to the
 * message the person just sent, and it stays where they can read it. Premium
 * lifts the limit, so the free version offers the plan; the premium version
 * only says when it resets.
 */
const QuotaNotice = ({ quota, onPremium }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  if (!quota) return null;

  return (
    <Card testID="spot-quota" style={tailwind("mb-lg border-warning")}>
      <View style={tailwind("flex-row items-center mb-xs")}>
        <Ionicons name="hourglass-outline" size={20} color={tokens.warning} />
        <Text variant="title" style={tailwind("ml-sm")}>
          That&apos;s today&apos;s {quota.limit}
        </Text>
      </View>
      <Text tone="muted">
        {quota.premium
          ? "Spot messages reset tomorrow. The poison lookup and your records still work."
          : `Free accounts get ${quota.limit} Spot messages a day. Premium lifts that, and the poison lookup and your records still work now.`}
      </Text>
      {!quota.premium && onPremium ? (
        <Button
          title="See Premium"
          variant="soft"
          fullWidth={false}
          testID="spot-quota-premium"
          onPress={onPremium}
          style={tailwind("mt-sm self-start")}
        />
      ) : null}
    </Card>
  );
};

export default QuotaNotice;

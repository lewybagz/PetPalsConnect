import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { useTailwind } from "../../../styles/tailwind";
import {
  describeStatus,
  fetchSubscriptionHistory,
  formatPrice,
} from "../../../api/subscriptions";

/**
 * Billing history.
 *
 * The rows previously read `item.date`, `item.plan` and `item.amount`; the
 * documents have `createdDate`, `planType` and `amount`, so two of three fields
 * rendered blank. It also had no empty state, so a new account saw a bare white
 * screen with no explanation.
 */
const SubscriptionHistoryScreen = () => {
  const tailwind = useTailwind();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = await fetchSubscriptionHistory();
        if (!cancelled) setHistory(rows);
      } catch (error) {
        if (!cancelled) console.warn("[subscription-history]", error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={tailwind("flex-1 items-center justify-center")}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => String(item._id ?? item.stripeSubscriptionId)}
      contentContainerStyle={tailwind("p-4 flex-grow")}
      ListEmptyComponent={
        <View style={tailwind("flex-1 items-center justify-center p-8")}>
          <Text style={tailwind("text-base text-textMuted text-center")}>
            Nothing here yet - you haven’t been billed for a subscription.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={tailwind("bg-surface border border-border rounded-2xl p-4 mb-3")}
        >
          <Text style={tailwind("text-lg font-semibold mb-1")}>
            {item.createdDate
              ? new Date(item.createdDate).toLocaleDateString()
              : "Unknown date"}
          </Text>
          <Text style={tailwind("text-base text-textMuted")}>
            Plan: {item.planType === "year" ? "Yearly" : "Monthly"}
          </Text>
          {item.amount != null ? (
            <Text style={tailwind("text-base text-textMuted")}>
              Amount: {formatPrice(item.amount, item.currency)}
            </Text>
          ) : null}
          <Text style={tailwind("text-base text-textMuted")}>
            Status: {describeStatus(item)}
          </Text>
        </View>
      )}
    />
  );
};

export default SubscriptionHistoryScreen;

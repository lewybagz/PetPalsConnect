import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { useTailwind } from "../../../styles/tailwind";
import {
  cancelSubscription,
  describeStatus,
  fetchCurrentSubscription,
  formatPrice,
  resumeSubscription,
} from "../../../api/subscriptions";
import { useTokens } from "../../../context/AppThemeContext";

/**
 * Shows and manages the current subscription.
 *
 * Everything this screen did before was broken in a way bundling cannot see:
 * `handleRenew` and friends were used as `onPress` handlers, so their `token`
 * parameter was actually the press event, and the `getToken()` call above it
 * threw the real token away (the shared API client attaches it anyway). It read
 * `subscription.PlanType` / `.StartDate` / `.Status` - none of which the schema
 * has - they are lowercase - so every field rendered blank. It called `/renew`
 * and `/change-plan`, which the server does not implement, and it rendered a
 * permanent loading spinner for anyone without a subscription, since `null` is
 * falsy and there was no empty state.
 */
const SubscriptionManagementScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await fetchCurrentSubscription();
        if (!cancelled) setSubscription(current);
      } catch (error) {
        if (cancelled) return;
        console.warn("[subscription]", error.message);
        Alert.alert("Error", "Could not load your subscription.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // The screen can be popped mid-request; setting state after that warns.
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (action, confirmation) => {
    setBusy(true);
    try {
      setSubscription(await action());
      Alert.alert("Done", confirmation);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () =>
    Alert.alert(
      "Cancel subscription?",
      "You’ll keep your benefits until the end of the period you've already paid for.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel subscription",
          style: "destructive",
          onPress: () =>
            run(cancelSubscription, "Your subscription will end at the period end."),
        },
      ]
    );

  if (loading) {
    return (
      <View testID="subscription-loading" style={tailwind("flex-1 items-center justify-center")}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!subscription) {
    return (
      <View testID="subscription-empty" style={tailwind("flex-1 items-center justify-center p-8")}>
        <Text style={tailwind("text-lg font-semibold mb-2")}>
          You’re on the free plan
        </Text>
        <Text style={tailwind("text-base text-textMuted text-center mb-6")}>
          PetPals Plus adds unlimited matches and priority playdates.
        </Text>
        <TouchableOpacity
          testID="see-plans"
          onPress={() => navigation.navigate("ChoosePlan")}
          style={tailwind("bg-primary rounded-xl px-6 py-3")}
        >
          <Text style={tailwind("text-onPrimary font-semibold")}>See plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renews = subscription.endDate ? new Date(subscription.endDate) : null;

  return (
    <View testID="subscription-detail" style={tailwind("flex-1 p-6")}>
      <Text style={tailwind("text-2xl font-bold mb-4")}>Your subscription</Text>

      <View style={tailwind("bg-surface border border-border rounded-2xl p-5 mb-6")}>
        <Text style={tailwind("text-base mb-1")}>
          Status: {describeStatus(subscription)}
        </Text>
        <Text style={tailwind("text-base mb-1")}>
          Billed: {subscription.planType === "year" ? "yearly" : "monthly"}
          {subscription.amount != null
            ? ` - ${formatPrice(subscription.amount, subscription.currency)}`
            : ""}
        </Text>
        {renews ? (
          <Text style={tailwind("text-base")}>
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}:{" "}
            {renews.toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      {subscription.cancelAtPeriodEnd ? (
        <TouchableOpacity
          testID="resume-subscription"
          disabled={busy}
          onPress={() => run(resumeSubscription, "Your subscription will continue.")}
          style={tailwind("bg-primary rounded-xl py-3 items-center")}
        >
          {busy ? (
            <ActivityIndicator color={tokens.surface} />
          ) : (
            <Text style={tailwind("text-onPrimary font-semibold")}>Resume subscription</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          testID="cancel-subscription"
          disabled={busy}
          onPress={confirmCancel}
          style={tailwind("border border-danger rounded-xl py-3 items-center")}
        >
          {busy ? (
            <ActivityIndicator color={tokens.danger} />
          ) : (
            <Text style={tailwind("text-danger font-semibold")}>
              Cancel subscription
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        testID="subscription-history"
        onPress={() => navigation.navigate("SubscriptionHistory")}
        style={tailwind("py-4 items-center")}
      >
        <Text style={tailwind("text-primary")}>Billing history</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SubscriptionManagementScreen;

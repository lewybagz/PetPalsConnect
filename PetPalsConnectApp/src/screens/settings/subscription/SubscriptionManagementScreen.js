import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from "react-native";

import { useTailwind } from "../../../styles/tailwind";
import {
  describeStatus,
  fetchCurrentSubscription,
  formatPrice,
  openManagement,
} from "../../../api/subscriptions";
import { useToast } from "../../../components/ui";

const STORE = Platform.OS === "ios" ? "App Store" : "Google Play";

/**
 * Shows the current subscription and hands off to the store to change it.
 *
 * Cancelling and resuming used to be buttons here that called the server.
 * A store subscription is the store's: the only place it can be cancelled,
 * paused or resumed is the store's own subscriptions page, and RevenueCat
 * reports the result back over the webhook. So the one action is "Manage",
 * which opens that page for this account.
 */
const SubscriptionManagementScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const toast = useToast();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await fetchCurrentSubscription();
        if (!cancelled) setSubscription(current);
      } catch (error) {
        if (cancelled) return;
        console.warn("[subscription]", error.message);
        toast.error("Couldn't load your subscription.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // The screen can be popped mid-request; setting state after that warns.
    return () => {
      cancelled = true;
    };
  }, [toast]);

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
        <Text style={tailwind("text-lg font-semibold mb-2 text-text")}>
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

  const ends = subscription.endDate ? new Date(subscription.endDate) : null;
  const endsNotRenews =
    subscription.cancelAtPeriodEnd || subscription.status === "canceled";

  return (
    <View testID="subscription-detail" style={tailwind("flex-1 p-6")}>
      <Text style={tailwind("text-2xl font-bold mb-4 text-text")}>Your subscription</Text>

      <View style={tailwind("bg-surface border border-border rounded-2xl p-5 mb-6")}>
        <Text style={tailwind("text-base mb-1 text-text")}>
          Status: {describeStatus(subscription)}
        </Text>
        <Text style={tailwind("text-base mb-1 text-text")}>
          Billed: {subscription.planType === "year" ? "yearly" : "monthly"}
          {subscription.amount != null
            ? ` - ${formatPrice(subscription.amount, subscription.currency)}`
            : ""}
        </Text>
        {ends ? (
          <Text style={tailwind("text-base text-text")}>
            {endsNotRenews ? "Ends" : "Renews"}: {ends.toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        testID="manage-subscription"
        onPress={() => openManagement().catch(() => toast.error(`Couldn't open ${STORE}.`))}
        style={tailwind("bg-primary rounded-xl py-3 items-center")}
      >
        <Text style={tailwind("text-onPrimary font-semibold")}>Manage in {STORE}</Text>
      </TouchableOpacity>
      <Text style={tailwind("text-xs text-textMuted text-center mt-2")}>
        Cancel, pause or change your plan there. Changes show here a few seconds
        later.
      </Text>

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

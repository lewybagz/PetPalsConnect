import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";

import { useTailwind } from "../../../styles/tailwind";
import { createSubscription, fetchPlans } from "../../../api/subscriptions";
import { useTokens } from "../../../context/AppThemeContext";

/**
 * Plan picker.
 *
 * The previous version listed three hardcoded tiers with hardcoded prices, then
 * POSTed to `/api/subscriptions/create-checkout-session` and tried to open
 * `https://checkout.stripe.com/pay/<sessionId>` in a browser. Checkout is a web
 * flow: a native app has no way to come back from it with a completed session,
 * and that URL shape has not been valid for years. Prices also disagreed with
 * whatever Stripe actually charged, because nothing connected the two.
 *
 * Plans now come from the server (which reads them from Stripe), and payment
 * uses PaymentSheet, the native flow: the server creates an incomplete
 * subscription, we collect the card, Stripe finishes it and tells the server
 * over a webhook.
 */
const ChoosePlanScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [plans, setPlans] = useState([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await fetchPlans();
        if (cancelled) return;
        setPlans(result.plans);
        setPaymentsEnabled(result.paymentsEnabled);
      } catch (error) {
        if (!cancelled) {
          console.warn("[plans]", error.message);
          setPaymentsEnabled(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(
    async (plan) => {
      setBusyPlanId(plan.id);
      try {
        const session = await createSubscription(plan.id);

        if (!session.clientSecret) {
          throw new Error("The server did not return a payment to complete");
        }

        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "PetPals Connect",
          customerId: session.customerId,
          customerEphemeralKeySecret: session.ephemeralKey,
          paymentIntentClientSecret: session.clientSecret,
          allowsDelayedPaymentMethods: false,
          returnURL: "petpalsconnect://stripe-redirect",
        });
        if (initError) throw new Error(initError.message);

        const { error: sheetError } = await presentPaymentSheet();
        if (sheetError) {
          // Closing the sheet is a normal thing to do, not an error to report.
          if (sheetError.code !== "Canceled") {
            Alert.alert("Payment not completed", sheetError.message);
          }
          return;
        }

        navigation.navigate("SubscriptionConfirmation", {
          action: "started",
          planName: plan.name,
        });
      } catch (error) {
        const message =
          error.response?.status === 409
            ? "You already have an active subscription."
            : error.response?.data?.message || error.message;
        Alert.alert("Could not start the subscription", message);
      } finally {
        setBusyPlanId(null);
      }
    },
    [initPaymentSheet, presentPaymentSheet, navigation]
  );

  if (loading) {
    return (
      <View style={tailwind("flex-1 items-center justify-center")}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const purchasable = plans.filter((plan) => plan.available);

  if (!paymentsEnabled || purchasable.length === 0) {
    return (
      <View style={tailwind("flex-1 items-center justify-center p-8")}>
        <Text style={tailwind("text-lg font-semibold text-center mb-2")}>
          Subscriptions are not available yet
        </Text>
        <Text style={tailwind("text-base text-textMuted text-center")}>
          Check back soon - everything in the app still works without one.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={tailwind("p-4")}>
      {purchasable.map((plan) => (
        <TouchableOpacity
          key={plan.id}
          testID={`plan-${plan.id}`}
          disabled={busyPlanId !== null}
          onPress={() => subscribe(plan)}
          style={tailwind(
            `bg-surface border border-border rounded-2xl p-5 mb-4 ${
              busyPlanId !== null && busyPlanId !== plan.id ? "opacity-50" : ""
            }`
          )}
        >
          <Text style={tailwind("text-xl font-bold mb-1")}>{plan.name}</Text>
          <Text style={tailwind("text-base text-textMuted mb-4")}>
            {plan.description}
          </Text>

          <View
            style={tailwind(
              "bg-primary rounded-xl py-3 items-center justify-center"
            )}
          >
            {busyPlanId === plan.id ? (
              <ActivityIndicator color={tokens.surface} />
            ) : (
              <Text style={tailwind("text-onPrimary font-semibold text-base")}>
                Subscribe {plan.interval === "year" ? "yearly" : "monthly"}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}

      <Text style={tailwind("text-xs text-textMuted text-center mt-2")}>
        Payments are handled by Stripe. Your card details never reach our
        servers. You can cancel any time from Settings.
      </Text>
    </ScrollView>
  );
};

export default ChoosePlanScreen;

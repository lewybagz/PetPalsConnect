import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { useTailwind } from "../../../styles/tailwind";

/**
 * Shown after PaymentSheet reports success.
 *
 * It previously destructured `route.params` unconditionally, so arriving
 * without params - which is what a deep link or a `navigate("...")` with no
 * arguments does - threw. It also printed a start and end date the payment flow
 * never had: Stripe confirms the subscription over a webhook a moment later, so
 * the dates are not known at this point. The management screen is the place
 * that shows real state.
 */
const SubscriptionConfirmationScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const { action = "started", planName } = route?.params ?? {};

  return (
    <View style={tailwind("flex-1 items-center justify-center p-8")}>
      <Text style={tailwind("text-2xl font-bold text-center mb-3")}>
        You’re all set
      </Text>
      <Text style={tailwind("text-base text-gray-600 text-center mb-2")}>
        {planName
          ? `Your ${planName} subscription has been ${action}.`
          : `Your subscription has been ${action}.`}
      </Text>
      <Text style={tailwind("text-sm text-gray-500 text-center mb-8")}>
        It can take a few seconds for the payment to be confirmed. You can check
        it any time under Settings.
      </Text>

      <TouchableOpacity
        testID="confirmation-manage"
        onPress={() => navigation.navigate("SubscriptionManagement")}
        style={tailwind("bg-blue-600 rounded-xl px-6 py-3 mb-3")}
      >
        <Text style={tailwind("text-white font-semibold")}>
          View my subscription
        </Text>
      </TouchableOpacity>

      <TouchableOpacity testID="confirmation-done" onPress={() => navigation.navigate("Tabs")}>
        <Text style={tailwind("text-blue-600")}>Back to the app</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SubscriptionConfirmationScreen;

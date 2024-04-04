import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SubscriptionManagementScreen from "../settings/subscription/SubscriptionManagementScreen";
import SubscriptionHistoryScreen from "../settings/subscription/SubscriptionHistoryScreen";
import SubscriptionOptionsScreen from "../settings/subscription/ChoosePlanScreen";
import SubscriptionConfirmationScreen from "../settings/subscription/SubscriptionConfirmationScreen";

const SubscriptionStack = createStackNavigator();

function SubscriptionStackNavigator() {
  return (
    <SubscriptionStack.Navigator
      initialRouteName="SubscriptionManagement"
      gestureEnabled:true
    >
      <SubscriptionStack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        // You can set options such as title, headerStyle, etc. here
      />
      <SubscriptionStack.Screen
        name="ChoosePlan"
        component={SubscriptionOptionsScreen}
      />
      <SubscriptionStack.Screen
        name="SubscriptionHistory"
        component={SubscriptionHistoryScreen}
      />
      <SubscriptionStack.Screen
        name="SubscriptionConfirmation"
        component={SubscriptionConfirmationScreen}
      />
    </SubscriptionStack.Navigator>
  );
}

export default SubscriptionStackNavigator;

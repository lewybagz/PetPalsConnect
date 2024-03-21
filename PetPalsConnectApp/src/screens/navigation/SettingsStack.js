import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SettingsScreen from "./path/to/SettingsScreen"; // Update the path accordingly
import ChangePasswordScreen from "./path/to/ChangePasswordScreen";
import PaymentMethodsScreen from "../settings/PaymentMethodsScreen"; // Import other screens similarly
import PrivacySettingsScreen from "../settings/PrivacySettingsScreen";
import AboutAppScreen from "../settings/AboutAppScreen";
import AccountInformationScreen from "../settings/AccountInformationScreen";
import AddPaymentMethodScreen from "../settings/AddPaymentMethodScreen";
import SecuritySettingsScreen from "../settings/SecuritySettingsScreen";
import NotificationPreferencesScreen from "../settings/NotificationPreferencesScreen";
import HelpSupportScreen from "../settings/HelpSupportScreen";
import LegalPoliciesScreen from "../settings/LegalPoliciesScreen";

// ... import other screens ...

const Stack = createStackNavigator();

const SettingsStack = () => {
  return (
    <Stack.Navigator initialRouteName="SettingsScreen">
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="AboutApp" component={AboutAppScreen} />
      <Stack.Screen
        name="AccountInformation"
        component={AccountInformationScreen}
      />
      <Stack.Screen
        name="AddPaymentMethod"
        component={AddPaymentMethodScreen}
      />
      <Stack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
      />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="LegalPolicies" component={LegalPoliciesScreen} />
    </Stack.Navigator>
  );
};

export default SettingsStack;

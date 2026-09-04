import React, { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTailwind } from "../../styles/tailwind";
import { Toggle } from "../../components/ui";

const NotificationPreferencesScreen = () => {
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(true);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(false);
  const tailwind = useTailwind();

  const togglePushNotifications = () => {
    setPushNotificationsEnabled((previousState) => !previousState);
    // Update push notification settings in user preferences
  };

  const toggleEmailNotifications = () => {
    setEmailNotificationsEnabled((previousState) => !previousState);
    // Update email notification settings in user preferences
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>
        Notification Preferences
      </Text>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Push Notifications</Text>
        <Toggle
          onValueChange={togglePushNotifications}
          value={pushNotificationsEnabled}
        />
      </View>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Email Notifications</Text>
        <Toggle
          onValueChange={toggleEmailNotifications}
          value={emailNotificationsEnabled}
        />
      </View>

      {/* Additional notification settings can be added here */}
    </ScrollView>
  );
};

export default NotificationPreferencesScreen;

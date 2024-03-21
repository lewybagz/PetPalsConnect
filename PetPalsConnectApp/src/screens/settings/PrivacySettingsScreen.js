import React, { useState } from "react";
import { View, Text, Switch, ScrollView } from "react-native";
import { useTailwind } from "nativewind";

const PrivacySettingsScreen = () => {
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState(true);
  const tailwind = useTailwind();

  const toggleLocationSharing = () => {
    setLocationSharingEnabled((previousState) => !previousState);
    // Update location sharing preference in user settings
  };

  const toggleProfileVisibility = () => {
    setProfileVisibility((previousState) => !previousState);
    // Update profile visibility preference in user settings
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Privacy Settings</Text>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Share Location</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={locationSharingEnabled ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleLocationSharing}
          value={locationSharingEnabled}
        />
      </View>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Profile Visibility</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={profileVisibility ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleProfileVisibility}
          value={profileVisibility}
        />
      </View>

      {/* Additional privacy options can be added here */}
    </ScrollView>
  );
};

export default PrivacySettingsScreen;

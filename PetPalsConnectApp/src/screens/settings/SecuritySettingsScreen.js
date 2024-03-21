import React, { useState } from "react";
import { View, Text, Switch, Alert, ScrollView } from "react-native";
import { useTailwind } from "nativewind";
import axios from "axios";

const SecuritySettingsScreen = () => {
  const [twoFactorAuthEnabled, setTwoFactorAuthEnabled] = useState(false);
  const tailwind = useTailwind();

  const handleTwoFactorAuthChange = async (isEnabled) => {
    try {
      // Replace with your actual API call
      await axios.post("/api/user/settings/2fa", {
        userId: "currentUser's ID", // replace with actual current user's ID
        enable2FA: isEnabled,
      });

      setTwoFactorAuthEnabled(isEnabled);
      Alert.alert(
        "Two-Factor Authentication",
        isEnabled ? "Enabled" : "Disabled"
      );
    } catch (error) {
      console.error("Error updating 2FA setting:", error);
      Alert.alert("Error", "Failed to update 2FA setting");
    }
  };

  const toggleTwoFactorAuth = () => {
    const newTwoFactorState = !twoFactorAuthEnabled;
    handleTwoFactorAuthChange(newTwoFactorState);
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Security Settings</Text>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Two-Factor Authentication</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={twoFactorAuthEnabled ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleTwoFactorAuth}
          value={twoFactorAuthEnabled}
        />
      </View>

      {/* Placeholder for additional security options */}
      {/* For example, adding a password change option or security questions */}
      {/* ... */}
    </ScrollView>
  );
};

export default SecuritySettingsScreen;

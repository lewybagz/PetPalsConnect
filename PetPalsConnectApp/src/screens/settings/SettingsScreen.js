import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, Alert } from "react-native";
import { getAuth, signOut } from "firebase/auth";
import Slider from "@react-native-community/slider";
import { useTailwind } from "nativewind";
import { useAppTheme } from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SettingsScreen = ({ navigation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const tailwind = useTailwind();
  const auth = getAuth();
  const { toggleAppTheme } = useAppTheme();
  const [playdateRange, setPlaydateRange] = useState(5);

  const handlePlaydateRangeChange = async (value) => {
    setPlaydateRange(value);
    try {
      await AsyncStorage.setItem("playdateRange", value.toString());
      // Update the user's preference on the backend
    } catch (error) {
      Alert.alert("Error", "Failed to save playdate range preference.");
    }
  };

  const toggleNotifications = async () => {
    setNotificationsEnabled((previousState) => !previousState);
    try {
      await AsyncStorage.setItem(
        "notificationsEnabled",
        JSON.stringify(!notificationsEnabled)
      );
      // If using Firebase or another backend, send the preference to the backend
    } catch (error) {
      // Handle error saving setting
    }
  };

  const toggleLocationSharing = async () => {
    const newState = !locationSharingEnabled;
    setLocationSharingEnabled(newState);
    try {
      await AsyncStorage.setItem(
        "locationSharingEnabled",
        JSON.stringify(newState)
      );
      // Here, you would also make an API call to update the user's preference on the backend
    } catch (error) {
      Alert.alert("Error", "Failed to save location sharing preference.");
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((previousState) => !previousState);
    toggleAppTheme();
  };

  const handleSignOut = () => {
    signOut(auth)
      .then(() => navigation.replace("Login"))
      .catch((error) => Alert.alert("Error", error.message));
  };

  return (
    <View style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold")}>Settings</Text>

      {/* Location Sharing Setting */}
      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Share My Location On The PetPalsMap</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={locationSharingEnabled ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleLocationSharing}
          value={locationSharingEnabled}
        />
      </View>

      <Text style={tailwind("my-2")}>
        PetPalsConnect Location Range: {playdateRange} miles
      </Text>
      <Text style={tailwind("text-center text-gray-600 mb-2")}>
        This range sets the stage for all your pet adventures, including
        matching with pals, setting up playdates, and more exciting features to
        come!
      </Text>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={5}
        maximumValue={20}
        step={5}
        value={playdateRange}
        onValueChange={handlePlaydateRangeChange}
      />

      <TouchableOpacity
        onPress={() => navigation.navigate("ChangePassword")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Change Password</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("PaymentMethods")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Payment Methods</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("AccountInformation")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Account Information</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("SecuritySettings")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Security Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("NotificationPreferences")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Notification Preferences</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("HelpSupport")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Help & Support</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("LegalPolicies")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Legal Policies</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("PrivacySettings")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Privacy Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("AboutApp")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>About PetPalsConnect</Text>
      </TouchableOpacity>

      {/* Notifications Setting */}
      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Enable Notifications</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={notificationsEnabled ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleNotifications}
          value={notificationsEnabled}
        />
      </View>

      {/* Dark Mode Setting */}
      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Dark Mode</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={darkMode ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleDarkMode}
          value={darkMode}
        />
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        onPress={handleSignOut}
        style={tailwind("mt-4 bg-red-500 py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-white text-center")}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SettingsScreen;

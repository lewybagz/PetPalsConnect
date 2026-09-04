import React, { useState, useEffect } from "react";
import { View, Text, Switch, TouchableOpacity, Alert } from "react-native";
import { getAuth, signOut } from "@react-native-firebase/auth";
import Slider from "@react-native-community/slider";
import { useTailwind } from "../../styles/tailwind";
import { useAppTheme } from "../../context/AppThemeContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import api from "../../api/axios";
import { readCache, writeCache, CacheKeys } from "../../services/localCache";

const SettingsScreen = ({ navigation }) => {
  const tailwind = useTailwind();
  const auth = getAuth();
  const { toggleAppTheme, isDark } = useAppTheme();
  const { deleteAccount } = useAuthSession();

  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [playdateRange, setPlaydateRange] = useState(25);
  const [notificationPreferences, setNotificationPreferences] = useState({
    petPalsMapUpdates: false,
    playdateReminders: false,
    appUpdates: false,
  });

  const darkMode = isDark;

  // Settings were stored in Realm (end-of-life September 2025) using a schema
  // imported from the backend package. They now live in AsyncStorage, and the
  // shared axios instance attaches the auth token, so the manual token plumbing
  // that used to wrap each of these handlers is gone.
  useEffect(() => {
    let cancelled = false;
    readCache(CacheKeys.settings).then((settings) => {
      if (cancelled || !settings) return;
      setLocationSharingEnabled(settings.locationSharingEnabled ?? true);
      setPlaydateRange(settings.playdateRange ?? 25);
      if (settings.notificationPreferences) {
        setNotificationPreferences(settings.notificationPreferences);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = (overrides) =>
    writeCache(CacheKeys.settings, {
      locationSharingEnabled,
      playdateRange,
      notificationPreferences,
      ...overrides,
    });

  const handlePlaydateRangeChange = async (value) => {
    setPlaydateRange(value);
    try {
      await persist({ playdateRange: value });
      await api.post("/api/users/settings", { playdateRange: value });
    } catch (error) {
      console.warn("[settings]", error.message);
      Alert.alert("Error", "Failed to save playdate range preference.");
    }
  };

  const toggleNotificationSetting = async (key) => {
    const next = { ...notificationPreferences, [key]: !notificationPreferences[key] };
    setNotificationPreferences(next);
    try {
      await persist({ notificationPreferences: next });
      await api.post("/api/users/notification-preferences", { [key]: next[key] });
    } catch (error) {
      console.warn("[settings]", error.message);
      setNotificationPreferences(notificationPreferences); // roll back
      Alert.alert("Error", `Failed to save the setting for ${key}.`);
    }
  };

  const toggleLocationSharing = async () => {
    const next = !locationSharingEnabled;
    setLocationSharingEnabled(next);
    try {
      await persist({ locationSharingEnabled: next });
      await api.post("/api/users/settings", { locationSharingEnabled: next });
    } catch (error) {
      console.warn("[settings]", error.message);
      setLocationSharingEnabled(!next); // roll back
      Alert.alert("Error", "Failed to save location sharing preference.");
    }
  };

  // RootNavigator swaps to the auth stack as soon as Firebase reports a signed
  // out user, so there is no navigation call to make here.
  const handleSignOut = () => {
    signOut(auth).catch((error) => Alert.alert("Error", error.message));
  };

  /**
   * In-app account deletion.
   *
   * Apple's App Store guideline 5.1.1(v) requires any app offering account
   * creation to offer account deletion from inside the app, so this is a
   * shipping requirement. Two taps to confirm, because it cannot be undone.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, pets, playdates and messages. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you sure?",
              "This is permanent. Your username will be released for someone else to use.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAccount();
                    } catch (error) {
                      Alert.alert(
                        "Could not delete account",
                        error.response?.data?.message ??
                          "Something went wrong. Please try again."
                      );
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  return (
    <View style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold")}>Settings</Text>

      <TouchableOpacity
        onPress={() => navigation.navigate("SubscriptionManagement")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Manage Subscription</Text>
      </TouchableOpacity>

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

      <Text testID="playdate-range" style={tailwind("my-2")}>
        PetPalsConnect Location Range: {playdateRange} miles
      </Text>
      <Text style={tailwind("text-center text-gray-600 mb-2")}>
        Discovery only shows you pets within this range - a playdate is
        something you have to travel to.
      </Text>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={5}
        maximumValue={100}
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

      {/* A block you cannot see is a block you cannot take back. */}
      <TouchableOpacity
        testID="settings-blocked-accounts"
        onPress={() => navigation.navigate("BlockedAccounts")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>Blocked Accounts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("AboutApp")}
        style={tailwind("my-2 p-2 border rounded border-gray-300")}
      >
        <Text>About PetPalsConnect</Text>
      </TouchableOpacity>

      {Object.entries(notificationPreferences).map(([key, value]) => (
        <View style={tailwind("flex-row justify-between py-2")} key={key}>
          <Text>
            {key.replace(/([A-Z])/g, " $1")}{" "}
            {/* Make the key more user-friendly */}
          </Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={value ? "#f5dd4b" : "#f4f3f4"}
            onValueChange={() => toggleNotificationSetting(key)}
            value={value}
          />
        </View>
      ))}

      {/* Dark Mode Setting */}
      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Dark Mode</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={darkMode ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={toggleAppTheme}
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

      {/* Account deletion - required by App Store guideline 5.1.1(v) */}
      <TouchableOpacity
        onPress={handleDeleteAccount}
        style={tailwind("mt-3 mb-8 py-2 px-4 rounded border border-red-300")}
      >
        <Text style={tailwind("text-red-600 text-center")}>Delete My Account</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SettingsScreen;

import React, { useState, useEffect } from "react";
import { View, Text, Switch, TouchableOpacity, Alert } from "react-native";
import { getAuth, signOut } from "firebase/auth";
import Slider from "@react-native-community/slider";
import { useTailwind } from "nativewind";
import { useAppTheme } from "../../context/ThemeContext";
import axios from "axios";
import { getRealm } from "../../../../backend/models/Settings";
import { getStoredToken } from "../../../utils/tokenutil";
import { setError } from "../../redux/actions";

const SettingsScreen = ({ navigation }) => {
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const tailwind = useTailwind();
  const auth = getAuth();
  const { toggleAppTheme } = useAppTheme();
  const [playdateRange, setPlaydateRange] = useState(5);
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => {
    const realm = getRealm();
    let settings = realm.objectForPrimaryKey("Settings", "unique_settings_id");
    if (settings) {
      setLocationSharingEnabled(settings.locationSharingEnabled);
      setPlaydateRange(settings.playdateRange);
      setDarkMode(settings.darkMode);
      setNotificationPreferences(JSON.parse(settings.notificationPreferences));
    }
  }, []);

  const [notificationPreferences, setNotificationPreferences] = useState({
    petPalsMapUpdates: false,
    playdateReminders: false,
    appUpdates: false,
  });

  const handlePlaydateRangeChange = async (value, token) => {
    const realm = await getRealm();
    setPlaydateRange(value);
    try {
      realm.write(() => {
        let settings = realm.objectForPrimaryKey(
          "Settings",
          "unique_settings_id"
        );
        if (!settings) {
          settings = realm.create("Settings", {
            _id: "unique_settings_id",
            playdateRange: value,
            locationSharingEnabled: locationSharingEnabled,
            darkMode: darkMode,
            notificationPreferences: JSON.stringify(notificationPreferences),
          });
        } else {
          settings.playdateRange = value;
        }
      });

      getToken();
      await axios.post(
        "/api/user/settings",
        { playdateRange: value },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save playdate range preference.");
    }
  };

  const toggleNotificationSetting = async (key, token) => {
    const newPreferences = {
      ...notificationPreferences,
      [key]: !notificationPreferences[key],
    };

    try {
      // Update state
      setNotificationPreferences(newPreferences);

      const realm = await getRealm();

      realm.write(() => {
        let settings = realm.objectForPrimaryKey(
          "Settings",
          "unique_settings_id"
        );
        if (settings) {
          settings.notificationPreferences = JSON.stringify(newPreferences);
        } else {
          realm.create("Settings", {
            _id: "unique_settings_id",
            playdateRange: playdateRange,
            locationSharingEnabled: locationSharingEnabled,
            darkMode: darkMode,
            notificationPreferences: JSON.stringify(notificationPreferences),
          });
        }
      });

      getToken();
      await axios.post(
        "/api/user/notification-preferences",
        {
          [key]: newPreferences[key],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      Alert.alert("Error", `Failed to save the setting for ${key}.`);
    }
  };

  const toggleLocationSharing = async (token) => {
    const newLocationSharingState = !locationSharingEnabled;
    setLocationSharingEnabled(newLocationSharingState);
    try {
      const realm = await getRealm();

      realm.write(() => {
        let settings = realm.objectForPrimaryKey(
          "Settings",
          "unique_settings_id"
        );
        if (settings) {
          settings.locationSharingEnabled = newLocationSharingState;
        } else {
          realm.create("Settings", {
            _id: "unique_settings_id",
            playdateRange: playdateRange,
            locationSharingEnabled: locationSharingEnabled,
            darkMode: darkMode,
            notificationPreferences: JSON.stringify(notificationPreferences),
          });
        }
      });

      getToken();
      await axios.post(
        "/api/user/settings",
        {
          locationSharingEnabled: newLocationSharingState,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
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

      <TouchableOpacity
        onPress={() => navigation.navigate("ManageSubscription")}
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

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { useTailwind } from "nativewind";

const AccountInformationScreen = () => {
  const [userInfo, setUserInfo] = useState({ name: "", email: "", phone: "" });
  const tailwind = useTailwind();
  const auth = getAuth();

  useEffect(() => {
    // Fetch user information
    // Replace with actual API call to fetch user data
    const user = auth.currentUser;
    setUserInfo({
      name: user.displayName,
      email: user.email,
      phone: user.phoneNumber,
    });
  }, [auth.currentUser]);

  const handleUpdate = () => {
    // Logic to update user information
    // Make an API call to update user details
    Alert.alert("Info Updated", "Your account information has been updated.");
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>
        Account Information
      </Text>

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={userInfo.name}
        onChangeText={(text) => setUserInfo({ ...userInfo, name: text })}
        placeholder="Name"
      />

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={userInfo.email}
        onChangeText={(text) => setUserInfo({ ...userInfo, email: text })}
        placeholder="Email"
        keyboardType="email-address"
      />

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={userInfo.phone}
        onChangeText={(text) => setUserInfo({ ...userInfo, phone: text })}
        placeholder="Phone Number"
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        onPress={handleUpdate}
        style={tailwind("bg-blue-500 py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-white text-center")}>
          Update Information
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AccountInformationScreen;

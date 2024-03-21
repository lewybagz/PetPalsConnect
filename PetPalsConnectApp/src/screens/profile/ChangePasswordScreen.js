import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { getAuth, updatePassword } from "firebase/auth";
import { useTailwind } from "nativewind";

const ChangePasswordScreen = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const tailwind = useTailwind();
  const auth = getAuth();

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords don't match.");
      return;
    }

    const user = auth.currentUser;
    updatePassword(user, newPassword)
      .then(() => {
        Alert.alert("Success", "Password changed successfully.");
      })
      .catch((error) => {
        Alert.alert("Error", error.message);
      });
  };

  return (
    <View style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Change Password</Text>

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Current Password"
        secureTextEntry
      />

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New Password"
        secureTextEntry
      />

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-6")}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm New Password"
        secureTextEntry
      />

      <TouchableOpacity
        onPress={handleChangePassword}
        style={tailwind("bg-blue-500 py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-white text-center")}>Change Password</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ChangePasswordScreen;

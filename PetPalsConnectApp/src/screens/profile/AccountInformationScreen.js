import React, { useState, useEffect } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import { useTailwind } from "nativewind";

const AccountInformationScreen = () => {
  const [userInfo, setUserInfo] = useState({ email: "", phone: "" });
  const tailwind = useTailwind();
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    // Fetch user information from Firestore
    const getUserProfile = async () => {
      const user = auth.currentUser;

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data();
            setUserInfo({
              email: profileData.email || user.email,
              phone: profileData.phone || "",
            });
          } else {
            Alert.alert("Profile Error", "No such document!");
          }
        } catch (error) {
          Alert.alert("Error", "An error occurred while fetching user data.");
        }
      } else {
        Alert.alert("User Error", "No user logged in!");
      }
    };

    getUserProfile();
  }, []);

  const handleUpdate = async () => {
    // Logic to update user information in Firestore
    try {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          email: userInfo.email,
          phone: userInfo.phone,
        });

        Alert.alert(
          "Info Updated",
          "Your account information has been updated."
        );
      } else {
        Alert.alert("Update Failed", "No user logged in.");
      }
    } catch (error) {
      console.error("Error updating user information:", error);
      Alert.alert(
        "Update Failed",
        "Unable to update account information. Please try again."
      );
    }
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>
        Account Information
      </Text>

      <Text style={tailwind("text-lg mb-4")}>
        {auth.currentUser?.displayName || "User"}
      </Text>

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

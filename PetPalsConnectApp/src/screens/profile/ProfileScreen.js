import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, ScrollView } from "react-native";
import { getAuth } from "firebase/auth";
import { useTailwind } from "nativewind";

const ProfileScreen = ({ navigation }) => {
  const [userInfo, setUserInfo] = useState({ name: "", email: "", phone: "" });
  const tailwind = useTailwind();
  const auth = getAuth();

  useEffect(() => {
    // Fetch user information
    const user = auth.currentUser;
    setUserInfo({
      name: user.displayName,
      email: user.email,
      phone: user.phoneNumber,
    });

    // TODO: Fetch additional user data like pets, activities, etc.
  }, [auth.currentUser]);

  const navigateToEditProfile = () => {
    navigation.navigate("EditProfile"); // Assuming 'EditProfile' is the route name for AccountInformationScreen
  };

  const navigateToPetList = () => {
    navigation.navigate("Pets"); // Assuming 'Pets' is the route name for PetListScreen
  };

  // TODO: Add functions to navigate to other screens like Playdates, Favorites, etc.

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Profile</Text>

      {/* User Info */}
      <Text style={tailwind("text-lg mb-2")}>{userInfo.name}</Text>
      <Text style={tailwind("text-sm mb-2")}>{userInfo.email}</Text>
      <Text style={tailwind("text-sm mb-4")}>{userInfo.phone}</Text>

      <TouchableOpacity
        onPress={navigateToEditProfile}
        style={tailwind("bg-blue-500 py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-white text-center")}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={navigateToPetList}
        style={tailwind("bg-blue-500 py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-white text-center")}>View My Pets</Text>
      </TouchableOpacity>

      {/* TODO: Add buttons or links to navigate to other features like Playdates, Favorite Articles, etc. */}

      {/* User's Activity History or Posts (Placeholder) */}
      {/* <View>
        <Text style={tailwind('text-lg mb-2')}>Recent Activity</Text>
        // Display user's activities or posts here
      </View> */}
    </ScrollView>
  );
};

export default ProfileScreen;

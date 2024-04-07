import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, ScrollView, FlatList } from "react-native";
import { getAuth } from "firebase/auth";
import { useTailwind } from "nativewind";
import { getStoredToken } from "../../../utils/tokenutil";
import PlaydateCardComponent from "../../components/PlaydateCardComponent";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";

const ProfileScreen = ({ navigation }) => {
  const [recentPlaydates, setRecentPlaydates] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

    // Fetch and process playdates for the current user
    const fetchUserPlaydates = async () => {
      setLoading(true);
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get("/api/playdates/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Sort playdates by date in descending order (most recent first)
        const sortedPlaydates = response.data.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        // Slice to get the three most recent playdates
        const recentPlaydates = sortedPlaydates.slice(0, 3);

        setRecentPlaydates(recentPlaydates);
      } catch (error) {
        setError("Failed to load playdates.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserPlaydates();
  }, [auth.currentUser]);

  const viewAllPlaydates = () => {
    // Navigate to MyPlaydatesScreen when 'View All' is pressed
    navigation.navigate("MyPlaydatesScreen");
  };

  const navigateToEditProfile = () => {
    navigation.navigate("EditProfile");
  };

  const navigateToPetList = () => {
    navigation.navigate("Pets");
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <Text style={tailwind("text-red-500")}>{error}</Text>;
  }

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
      <FlatList
        data={recentPlaydates}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <PlaydateCardComponent playdate={item} navigation={navigation} />
        )}
      />
      <TouchableOpacity
        onPress={viewAllPlaydates}
        style={tailwind("bg-blue-500 py-2 px-4 rounded my-4")}
      >
        <Text style={tailwind("text-white text-center")}>View All</Text>
      </TouchableOpacity>{" "}
      <TouchableOpacity
        onPress={() => {
          /* Implement logout functionality */
        }}
        style={tailwind("bg-red-500 py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-white text-center")}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ProfileScreen;

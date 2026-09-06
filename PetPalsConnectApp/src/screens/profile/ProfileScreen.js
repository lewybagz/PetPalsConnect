import React, { useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "@react-native-firebase/auth";
import { useTailwind } from "../../styles/tailwind";
import { getStoredToken } from "../../../utils/tokenutil";
import PlaydateCardComponent from "../../components/PlaydateCardComponent";
import LoadingScreen from "../../components/LoadingScreenComponent";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { addProfilePhoto } from "../../services/photos";
import { useTokens } from "../../context/AppThemeContext";
import { petPhoto } from "../../utils/petIdentity";
import { useToast } from "../../components/ui";

const ProfileScreen = ({ navigation }) => {
  const [recentPlaydates, setRecentPlaydates] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const auth = getAuth();
  const { profile, userId, refresh } = useAuthSession();
  const [photo, setPhoto] = useState(profile?.userPhoto ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // The household. `useAuthSession` already populates the profile's pets - the
  // onboarding gate reads that array to decide whether you have one.
  // Hoisted, so the dependency is the array itself rather than `profile` -
  // React Compiler widens `profile?.pets` in a dependency list to the whole
  // object and then declines to memoize around it.
  const profilePets = profile?.pets;
  const pets = useMemo(
    () => (Array.isArray(profilePets) ? profilePets.filter(Boolean) : []),
    [profilePets]
  );
  const petNames = useMemo(
    () =>
      pets
        .map((pet) => pet?.name)
        .filter(Boolean)
        .join(" and "),
    [pets]
  );

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
        const response = await api.get("/api/playdates/user", {
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
        console.warn("[profile]", error.message);
        setError("Failed to load playdates.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserPlaydates();
  }, [auth.currentUser]);

  const viewAllPlaydates = () => {
    // Navigate to MyPlaydatesScreen when 'View All' is pressed
    navigation.navigate("MyPlaydates");
  };

  const navigateToEditProfile = () => {
    // No "EditProfile" screen exists; account details are edited here.
    navigation.navigate("AccountInformation");
  };

  const navigateToPetList = () => {
    navigation.navigate("PetList");
  };

  /**
   * There was no way to set a profile photo anywhere in the app. `userPhoto`
   * has always been on the schema and rendered in chats, friend lists and
   * search results - and nothing could ever fill it in.
   */
  const changePhoto = async () => {
    setUploadingPhoto(true);
    try {
      const result = await addProfilePhoto();

      if (result.denied) {
        toast.show("Allow photo access in your device settings.");
        return;
      }
      if (result.cancelled) return;

      await api.patch(`/api/users/${userId}`, { userPhoto: result.url });
      setPhoto(result.url);
      // The session holds the profile the rest of the app reads.
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <Text style={tailwind("text-danger")}>{error}</Text>;
  }

  return (
    <ScrollView style={tailwind("p-4")}>
      {/* The pets are the profile. This screen led with the abstract noun
          "Profile", an owner avatar and three lines of account data, and put
          the animals behind a "View My Pets" button - on the one screen in the
          app whose entire subject is a household of pets. */}
      <Text style={tailwind("text-xl font-bold mb-4")}>
        {petNames ? `${petNames} and their human` : "Your profile"}
      </Text>

      {pets.length > 0 ? (
        <FlatList
          data={pets}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(pet) => String(pet._id)}
          style={tailwind("mb-4")}
          renderItem={({ item }) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${item.name ?? "A pet"}, open profile`}
              onPress={() =>
                navigation.navigate("PetDetails", { petId: String(item._id) })
              }
              style={tailwind("items-center mr-md")}
            >
              {petPhoto(item) ? (
                <Image
                  source={{ uri: petPhoto(item) }}
                  style={tailwind("h-24 w-24 rounded-full")}
                />
              ) : (
                <View
                  style={tailwind(
                    "h-24 w-24 rounded-full bg-surfaceAlt items-center justify-center"
                  )}
                >
                  <Ionicons name="paw" size={34} color={tokens.textFaint} />
                </View>
              )}
              <Text style={tailwind("mt-2 text-text")}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      ) : null}

      <Text style={tailwind("text-sm text-textMuted mb-2")}>
        {pets.length > 0 ? "Brought to you by" : "Add a pet to get started"}
      </Text>

      <TouchableOpacity
        testID="profile-photo"
        onPress={changePhoto}
        disabled={uploadingPhoto}
        style={tailwind("items-center mb-4")}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={tailwind("h-24 w-24 rounded-full")} />
        ) : (
          <View
            style={tailwind(
              "h-24 w-24 rounded-full bg-surfaceAlt items-center justify-center"
            )}
          >
            <Ionicons name="person-outline" size={30} color={tokens.textFaint} />
          </View>
        )}
        {uploadingPhoto ? (
          <ActivityIndicator style={tailwind("mt-2")} />
        ) : (
          <Text style={tailwind("text-primary mt-2")}>
            {photo ? "Change photo" : "Add a photo"}
          </Text>
        )}
      </TouchableOpacity>

      {/* The owner: still here, still legible, no longer the headline. */}
      <Text style={tailwind("text-lg mb-2")}>{userInfo.name}</Text>
      <Text style={tailwind("text-sm mb-2")}>{userInfo.email}</Text>
      <Text style={tailwind("text-sm mb-4")}>{userInfo.phone}</Text>
      <TouchableOpacity
        onPress={navigateToEditProfile}
        style={tailwind("bg-primary py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={navigateToPetList}
        style={tailwind("bg-primary py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>Manage my pets</Text>
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
        style={tailwind("bg-primary py-2 px-4 rounded my-4")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>View All</Text>
      </TouchableOpacity>{" "}
      <TouchableOpacity
        onPress={() => {
          /* Implement logout functionality */
        }}
        style={tailwind("bg-danger py-2 px-4 rounded mb-4")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ProfileScreen;

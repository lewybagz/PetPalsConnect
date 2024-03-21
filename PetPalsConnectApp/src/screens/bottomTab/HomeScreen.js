import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { getAuth } from "firebase/auth";
import { useTailwind } from "nativewind";
import { copilot, walkthroughable, CopilotStep } from "react-native-copilot";
import CustomTooltip from "../../components/CustomTooltip";

// Replace this with your actual API call imports
import { fetchLatestPets, fetchUserFavorites } from "../api/petApi";
import MatchingAlgorithmPopup from "../../components/MatchingAlgorithmPopupComponent";

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableImage = walkthroughable(Image);

const HomeScreen = ({ navigation, route, start }) => {
  const [latestPets, setLatestPets] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showMatchingAlgorithmPopup, setShowMatchingAlgorithmPopup] =
    useState(false);
  const tailwind = useTailwind();
  const auth = getAuth();

  useEffect(() => {
    fetchLatestPets().then(setLatestPets);
    fetchUserFavorites(auth.currentUser.uid).then(setFavorites);

    // Start the copilot tutorial if it's a new user
    if (route.params?.showTutorial) {
      start();
    }

    // Check if the matching algorithm popup should be shown
    const shouldShowPopup = route.params?.showPopup;
    setShowMatchingAlgorithmPopup(shouldShowPopup);
  }, [start, route.params?.showPopup, auth.currentUser.uid]);

  const renderFavoriteItem = (favorite) => {
    // Determine if the favorite is a pet or a playdate based on its structure or a specific field
    const isPet = favorite.breed; // Example condition
    if (isPet) {
      return <Text>Pet: {favorite.name}</Text>; // Customize as needed
    } else {
      return <Text>Playdate at: {favorite.location}</Text>; // Customize as needed
    }
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      {/* Copilot Steps and your components */}
      <CopilotStep text="Welcome to PetPalsConnect!" order={1} name="welcome">
        <WalkthroughableText style={tailwind("text-xl font-bold")}>
          Welcome to PetPalsConnect!
        </WalkthroughableText>
      </CopilotStep>
      {/* Navigation Buttons */}
      <View style={tailwind("flex-row justify-around my-4")}>
        <WalkthroughableTouchableOpacity
          onPress={() => navigation.navigate("Profile")}
        >
          <Text style={tailwind("text-lg")}>Profile</Text>
        </WalkthroughableTouchableOpacity>

        <WalkthroughableTouchableOpacity
          onPress={() => navigation.navigate("PetList")}
        >
          <Text style={tailwind("text-lg")}>Browse Pets</Text>
        </WalkthroughableTouchableOpacity>

        <WalkthroughableTouchableOpacity
          onPress={() => navigation.navigate("Settings")}
        >
          <Text style={tailwind("text-lg")}>Settings</Text>
        </WalkthroughableTouchableOpacity>

        <WalkthroughableTouchableOpacity
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={tailwind("text-lg")}>Notifications</Text>
        </WalkthroughableTouchableOpacity>
      </View>
      <CopilotStep
        text="Check out the latest pets here"
        order={3}
        name="latestPets"
      >
        <View>
          <WalkthroughableText style={tailwind("text-lg font-semibold")}>
            Latest Pets
          </WalkthroughableText>
          {/* Horizontal ScrollView for latest pets */}
          <ScrollView horizontal>
            {latestPets.map((pet) => (
              <WalkthroughableTouchableOpacity
                key={pet.id}
                style={tailwind("mr-2")}
              >
                <WalkthroughableImage
                  source={{ uri: pet.image }}
                  style={tailwind("h-40 w-40")}
                />
                <Text>{pet.name}</Text>
              </WalkthroughableTouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </CopilotStep>
      <CopilotStep
        text="Your favorite pets and places are here"
        order={4}
        name="favorites"
      >
        <View style={tailwind("mt-4")}>
          <WalkthroughableText style={tailwind("text-lg font-semibold")}>
            Your Favorites
          </WalkthroughableText>
          <View>
            {favorites.map((favorite) => (
              <TouchableOpacity key={favorite.id} style={tailwind("py-2")}>
                {renderFavoriteItem(favorite)}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </CopilotStep>
      {showMatchingAlgorithmPopup && (
        <MatchingAlgorithmPopup
          visible={showMatchingAlgorithmPopup}
          onClose={() => setShowMatchingAlgorithmPopup(false)}
        />
      )}
    </ScrollView>
  );
};

export default copilot({
  tooltipComponent: CustomTooltip,
})(HomeScreen);

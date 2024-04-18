import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { getAuth } from "firebase/auth";
import { useTailwind } from "nativewind";
import { copilot, walkthroughable, CopilotStep } from "react-native-copilot";
import CustomTooltip from "../../components/CustomTooltip";
import ArticleCard from "../../components/ArticleCardComponent";
import AnimatedButton from "../../components/AnimatedButton";
import { getStoredToken } from "../../../utils/tokenutil";
import axios from "axios";
import Icon from "react-native-vector-icons/Ionicons";
import MatchingAlgorithmPopup from "../../components/MatchingAlgorithmPopupComponent";

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableImage = walkthroughable(Image);

// Fetch the latest pets
export const fetchLatestPets = async () => {
  const token = await getStoredToken();
  return axios.get("/api/pets/latest", {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Fetch user favorites
export const fetchUserFavorites = async (userId) => {
  const token = await getStoredToken();
  return axios.get(`/api/users/favorites/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

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

    if (route.params?.showTutorial) {
      start();
    }

    const shouldShowPopup = route.params?.showPopup;
    setShowMatchingAlgorithmPopup(shouldShowPopup);
  }, [start, route.params?.showPopup, auth.currentUser.uid]);

  const [latestArticle, setLatestArticle] = useState(null);

  useEffect(() => {
    const fetchLatestArticle = async () => {
      try {
        const token = await getStoredToken();
        const response = await axios.get("/api/articles/latest", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLatestArticle(response.data);
      } catch (error) {
        console.error("Error fetching latest article:", error);
      }
    };

    fetchLatestArticle();
  }, []);

  const renderFavoriteItem = (favorite) => {
    const isPet = favorite.breed;
    if (isPet) {
      return <Text>Pet: {favorite.name}</Text>;
    } else {
      return <Text>Playdate at: {favorite.location}</Text>;
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
      <CopilotStep
        text="Swipe right to go back or swipe left to navigate to the map."
        order={1}
        name="swipeGesture"
      >
        <WalkthroughableTouchableOpacity
          onPress={() => {}} // This doesn't need to perform an action on press
          style={tailwind("items-center justify-center")}
        >
          <Icon
            name="md-swipe"
            size={30}
            color="#000"
            style={tailwind("mb-2")}
          />
          <WalkthroughableText style={tailwind("text-base")}>
            Swipe left to open the Map
          </WalkthroughableText>
        </WalkthroughableTouchableOpacity>
      </CopilotStep>
      {showMatchingAlgorithmPopup && (
        <MatchingAlgorithmPopup
          visible={showMatchingAlgorithmPopup}
          onClose={() => setShowMatchingAlgorithmPopup(false)}
          navigation={navigation}
        />
      )}
      <View>
        <ArticleCard
          article={latestArticle}
          onPress={() =>
            navigation.navigate("ArticleDetail", {
              articleId: latestArticle.id,
            })
          }
        />

        <AnimatedButton
          text="View All Articles"
          onPress={() => navigation.navigate("Articles")}
          buttonStyle={styles.animatedButton}
          textStyle={styles.animatedButtonText}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // ... other styles

  animatedButton: {
    // Style for the button, e.g., padding, background color
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#007bff", // Example color
    borderRadius: 5,
  },
  animatedButtonText: {
    // Style for the text inside the button
    color: "white",
    fontSize: 16,
  },
});

export default copilot({
  tooltipComponent: CustomTooltip,
})(HomeScreen);

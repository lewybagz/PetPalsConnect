import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { copilot, walkthroughable, CopilotStep } from "react-native-copilot";
import axios from "axios";
import UserPetCard from "../components/UserPetCard";
import PlayDateLocationCard from "../components/PlayDateLocationCardComponent";
import CustomTooltip from "../../components/CustomTooltip";
import { getStoredToken } from "../../../utils/tokenutil";

// Walkthroughable components
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

const FavoritesScreen = ({ route, start }) => {
  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState("pets");

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const token = await getStoredToken(); // Retrieve the token
        const response = await axios.get("/api/favorites", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFavorites(response.data);
      } catch (error) {
        console.error("Error fetching favorites:", error);
        Alert.alert("Error", "Failed to load favorites");
      }
    };

    fetchFavorites();

    if (route.params?.showTutorial) {
      start(); // Start copilot tutorial
    }
  }, [route.params?.showTutorial]);

  const renderFavoriteItem = ({ item }) => {
    if (activeTab === "pets" && item.type === "pet") {
      return <UserPetCard data={item.content} type="pet" />;
    } else if (activeTab === "places" && item.type === "place") {
      // Render place item using PlayDateLocationCard component
      return <PlayDateLocationCard locationData={item.content} />;
    }
  };

  const hasFavoritesInTab = (type) => {
    return favorites.some((favorite) => favorite.type === type);
  };

  return (
    <View style={styles.container}>
      {/* Tabs for selecting pet or place favorites */}
      <CopilotStep
        text="Here you can switch between your favorite pets and places."
        order={1}
        name="tabs"
      >
        <View style={styles.tabsContainer}>
          <WalkthroughableTouchableOpacity
            style={[styles.tab, activeTab === "pets" && styles.activeTab]}
            onPress={() => setActiveTab("pets")}
          >
            <Text style={styles.tabText}>Pets</Text>
          </WalkthroughableTouchableOpacity>
          <WalkthroughableTouchableOpacity
            style={[styles.tab, activeTab === "places" && styles.activeTab]}
            onPress={() => setActiveTab("places")}
          >
            <Text style={styles.tabText}>Places</Text>
          </WalkthroughableTouchableOpacity>
        </View>
      </CopilotStep>

      {/* Messages for no favorites */}
      <CopilotStep
        text="This message shows when you have no favorite pets."
        order={2}
        name="noFavoritesPets"
      >
        <WalkthroughableText>
          {activeTab === "pets" && !hasFavoritesInTab("pet") && (
            <Text style={styles.noFavoritesText}>No favorite pets...</Text>
          )}
        </WalkthroughableText>
      </CopilotStep>

      <CopilotStep
        text="This message shows when you have no favorite places."
        order={3}
        name="noFavoritesPlaces"
      >
        <WalkthroughableText>
          {activeTab === "places" && !hasFavoritesInTab("place") && (
            <Text style={styles.noFavoritesText}>No favorite places...</Text>
          )}
        </WalkthroughableText>
      </CopilotStep>

      {/* List of favorites */}
      <CopilotStep
        text="All your favorites are listed here. Tap on one for more details."
        order={4}
        name="favoritesList"
      >
        <FlatList
          data={favorites}
          keyExtractor={(item) => item._id}
          renderItem={renderFavoriteItem}
        />
      </CopilotStep>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
  },
  tab: {
    marginHorizontal: 10,
    paddingBottom: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "blue",
  },
  tabText: {
    color: "grey",
  },
  noFavoritesText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 18,
    color: "gray",
  },
});

export default copilot({
  tooltipComponent: CustomTooltip,
})(FavoritesScreen);

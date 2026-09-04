import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  copilot,
  walkthroughable,
  CopilotStep,
  TOURS,
} from "../../components/walkthrough";
import api from "../../api/axios";
import UserPetCard from "../../components/UserPetCardComponent";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import CustomTooltip from "../../components/CustomTooltip";
import { getStoredToken } from "../../../utils/tokenutil";
import { useTokens } from "../../context/AppThemeContext";
import { useToast } from "../../components/ui";

// Walkthroughable components
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

const FavoritesScreen = ({ route, start, navigation }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [favorites, setFavorites] = useState([]);
  const [activeTab, setActiveTab] = useState("pets");

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const token = await getStoredToken();
        const response = await api.get("/api/favorites", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFavorites(response.data);
      } catch (error) {
        console.error("Error fetching favorites:", error);
        toast.error("Couldn't load your favourites.");
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
      return (
        <PlayDateLocationCard
          locationData={item.content}
          navigation={navigation}
        />
      );
    }
  };

  const hasFavoritesInTab = (type) => {
    return favorites.some((favorite) => favorite.type === type);
  };

  return (
    <View style={styles.container}>
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
        // The step's measuring view is a real node. Without a height to fill,
        // the list inside it has nothing to scroll in.
        style={styles.list}
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

const makeStyles = (t) => StyleSheet.create({
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
    borderBottomColor: t.primary,
  },
  tabText: {
    color: t.textMuted,
  },
  list: {
    flex: 1,
  },
  noFavoritesText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 18,
    color: t.textMuted,
  },
});

export default copilot({
  tooltipComponent: CustomTooltip,
  name: TOURS.favorites,
})(FavoritesScreen);

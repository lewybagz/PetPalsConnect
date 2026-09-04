import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { copilot, walkthroughable, CopilotStep } from "../../components/walkthrough";
import CustomTooltip from "../../components/CustomTooltip";
import ArticleCard from "../../components/ArticleCardComponent";
import AnimatedButton from "../../components/AnimatedButton";
import MatchingAlgorithmPopup from "../../components/MatchingAlgorithmPopupComponent";
import api from "../../api/axios";

/**
 * The first screen after sign-in, and it could not render.
 *
 * It called `StyleSheet.create` at module scope without importing StyleSheet,
 * so importing this file threw a ReferenceError and took the Home tab out
 * entirely. Lint did not catch it: eslint-config-expo loads the browser
 * globals so the app can target web, and the DOM defines `StyleSheet`. That
 * blind spot is now closed in eslint.config.js.
 *
 * Underneath it were four more failures, none of which bundling can see:
 *
 * - `fetchLatestPets().then(setLatestPets)` stored the axios *response*, so
 *   `latestPets.map` threw on an object.
 * - favourites were fetched with `auth.currentUser.uid`, a Firebase uid, against
 *   a route that does `User.findById` - a CastError and a 500 every time. The
 *   Mongo id is on the session profile.
 * - `import Icon from "@expo/vector-icons"` imports the module, not a
 *   component, and `md-swipe` has not been a valid icon name since v10.
 * - pets were read as `pet.id` / `pet.image` and favourites as
 *   `favorite.breed`; the schema has `_id`, `photos[]`, and a favourite is a
 *   Favorite document with a populated `pet`.
 * - `<ArticleCard article={null}>` rendered before the fetch resolved.
 *
 * Neither fetch had a `catch`, so each failure also surfaced as an unhandled
 * rejection rather than as anything the user could act on.
 */

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableImage = walkthroughable(Image);

const SHORTCUTS = [
  { label: "Profile", route: "Profile", icon: "person-outline" },
  { label: "Browse Pets", route: "PetList", icon: "paw-outline" },
  { label: "Map", route: "Map", icon: "map-outline" },
  { label: "Settings", route: "Settings", icon: "settings-outline" },
];

/** First photo, or null - `photos` is an array and is often empty. */
const petPhoto = (pet) => (Array.isArray(pet?.photos) ? pet.photos[0] : null) ?? null;

const HomeScreen = ({ navigation, route, start }) => {
  const tailwind = useTailwind();

  const [latestPets, setLatestPets] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [latestArticle, setLatestArticle] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped by pull-to-refresh. Using `refreshing` itself as the effect's
  // dependency would re-run it twice per pull - once on true, once on false.
  const [reloadToken, setReloadToken] = useState(0);
  const [showMatchingAlgorithmPopup, setShowMatchingAlgorithmPopup] = useState(
    Boolean(route.params?.showPopup)
  );

  useEffect(() => {
    let cancelled = false;

    /**
     * Each section is fetched independently and failures are swallowed into an
     * empty section: one endpoint being down should cost you that shelf, not
     * the whole home screen.
     */
    const load = async () => {
      const [pets, favouriteRows, article] = await Promise.all([
        api.get("/api/pets/latest").then((r) => r.data, () => []),
        // Scoped by the token, so this does not wait on the profile to load.
        api.get("/api/favorites").then((r) => r.data, () => []),
        api.get("/api/articles/latest").then((r) => r.data, () => null),
      ]);

      if (cancelled) return;
      setLatestPets(Array.isArray(pets) ? pets : []);
      setFavorites(Array.isArray(favouriteRows) ? favouriteRows : []);
      setLatestArticle(article);
      setRefreshing(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (route.params?.showTutorial) start();
  }, [route.params?.showTutorial, start]);

  return (
    <ScrollView
      style={tailwind("flex-1")}
      contentContainerStyle={tailwind("p-4")}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setReloadToken((token) => token + 1);
          }}
        />
      }
    >
      <CopilotStep text="Welcome to PetPalsConnect!" order={1} name="welcome">
        <WalkthroughableText style={tailwind("text-2xl font-bold mb-4")}>
          Welcome to PetPals Connect
        </WalkthroughableText>
      </CopilotStep>

      <View style={tailwind("flex-row justify-between mb-6")}>
        {SHORTCUTS.map((shortcut) => (
          <WalkthroughableTouchableOpacity
            key={shortcut.route}
            testID={`shortcut-${shortcut.route}`}
            onPress={() => navigation.navigate(shortcut.route)}
            style={tailwind("items-center")}
          >
            <View style={tailwind("bg-blue-50 rounded-2xl p-3 mb-1")}>
              <Ionicons name={shortcut.icon} size={22} color="#2563eb" />
            </View>
            <Text style={tailwind("text-xs text-gray-600")}>{shortcut.label}</Text>
          </WalkthroughableTouchableOpacity>
        ))}
      </View>

      <CopilotStep text="Check out the latest pets here" order={3} name="latestPets">
        <View style={tailwind("mb-6")}>
          <WalkthroughableText style={tailwind("text-lg font-semibold mb-2")}>
            Latest Pets
          </WalkthroughableText>

          {latestPets.length === 0 ? (
            <Text style={tailwind("text-base text-gray-500")}>
              No pets to show yet. Check back soon.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {latestPets.map((pet) => (
                <WalkthroughableTouchableOpacity
                  key={pet._id}
                  testID={`pet-${pet._id}`}
                  onPress={() => navigation.navigate("PetDetails", { petId: pet._id })}
                  style={tailwind("mr-3")}
                >
                  {petPhoto(pet) ? (
                    <WalkthroughableImage
                      source={{ uri: petPhoto(pet) }}
                      style={tailwind("h-32 w-32 rounded-2xl")}
                    />
                  ) : (
                    <View
                      style={tailwind(
                        "h-32 w-32 rounded-2xl bg-gray-100 items-center justify-center"
                      )}
                    >
                      <Ionicons name="paw-outline" size={28} color="#9ca3af" />
                    </View>
                  )}
                  <Text style={tailwind("mt-1 text-center text-sm")}>{pet.name}</Text>
                </WalkthroughableTouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </CopilotStep>

      <CopilotStep text="Your favorite pets and places are here" order={4} name="favorites">
        <View style={tailwind("mb-6")}>
          <WalkthroughableText style={tailwind("text-lg font-semibold mb-2")}>
            Your Favorites
          </WalkthroughableText>

          {favorites.length === 0 ? (
            <Text style={tailwind("text-base text-gray-500")}>
              Nothing saved yet. Tap the heart on a pet to keep it here.
            </Text>
          ) : (
            favorites.map((favorite) => (
              <TouchableOpacity
                key={favorite._id}
                testID={`favorite-${favorite._id}`}
                onPress={() =>
                  favorite.pet &&
                  navigation.navigate("PetDetails", { petId: favorite.pet._id })
                }
                style={tailwind("py-2")}
              >
                <Text style={tailwind("text-base")}>
                  {favorite.pet?.name ?? "Saved item"}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </CopilotStep>

      <CopilotStep
        text="Swipe right to go back or swipe left to navigate to the map."
        order={5}
        name="swipeGesture"
      >
        <TouchableOpacity
          testID="open-map"
          onPress={() => navigation.navigate("Map")}
          style={tailwind("items-center justify-center mb-6")}
        >
          <Ionicons name="map-outline" size={28} color="#111827" />
          <Text style={tailwind("text-base mt-1")}>Open the map</Text>
        </TouchableOpacity>
      </CopilotStep>

      {latestArticle ? (
        <View>
          <ArticleCard
            article={latestArticle}
            onPress={() =>
              navigation.navigate("ArticleDetail", { articleId: latestArticle._id })
            }
          />
          <AnimatedButton
            text="View All Articles"
            onPress={() => navigation.navigate("Articles")}
            buttonStyle={tailwind("bg-blue-600 rounded-lg px-5 py-3 mt-2")}
            textStyle={tailwind("text-white text-base text-center")}
          />
        </View>
      ) : null}

      {showMatchingAlgorithmPopup && (
        <MatchingAlgorithmPopup
          visible={showMatchingAlgorithmPopup}
          onClose={() => setShowMatchingAlgorithmPopup(false)}
          navigation={navigation}
        />
      )}
    </ScrollView>
  );
};

export default copilot({ tooltipComponent: CustomTooltip })(HomeScreen);

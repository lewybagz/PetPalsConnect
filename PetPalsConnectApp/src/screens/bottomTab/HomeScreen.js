import React, { useEffect, useState } from "react";
import {
  View,
  Text as RNText,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { space } from "../../styles/tokens";
import { Button, Screen, Skeleton, Text } from "../../components/ui";
import { copilot, walkthroughable, CopilotStep } from "../../components/walkthrough";
import CustomTooltip from "../../components/CustomTooltip";
import ArticleCard from "../../components/ArticleCardComponent";
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
 *
 * It also had no loading state at all: every shelf rendered as its own empty
 * message until the data landed, so a first launch on a slow connection said
 * "No pets to show yet" and "Nothing saved yet" before it had asked. The
 * structure here is completely predictable before the response, which is what
 * skeletons are for.
 */

const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);
const WalkthroughableText = walkthroughable(RNText);
const WalkthroughableImage = walkthroughable(Image);

const SHORTCUTS = [
  { label: "Profile", route: "Profile", icon: "person-outline" },
  { label: "Browse Pets", route: "PetList", icon: "paw-outline" },
  { label: "Map", route: "Map", icon: "map-outline" },
  { label: "Settings", route: "Settings", icon: "settings-outline" },
];

/** First photo, or null - `photos` is an array and is often empty. */
const petPhoto = (pet) => (Array.isArray(pet?.photos) ? pet.photos[0] : null) ?? null;

const PetShelfSkeleton = () => {
  const tailwind = useTailwind();

  return (
    <View testID="home-pets-loading" style={tailwind("flex-row")}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={tailwind("mr-md")}>
          <Skeleton width={128} height={128} rounded="card" />
          <View style={{ height: space.sm }} />
          <Skeleton width={80} height={13} />
        </View>
      ))}
    </View>
  );
};

const HomeScreen = ({ navigation, route, start }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();

  const [latestPets, setLatestPets] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [latestArticle, setLatestArticle] = useState(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
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
    <Screen
      testID="home"
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={tokens.textMuted}
          onRefresh={() => {
            setRefreshing(true);
            setReloadToken((token) => token + 1);
          }}
        />
      }
    >
      <CopilotStep text="Welcome to PetPalsConnect!" order={1} name="welcome">
        <WalkthroughableText
          style={[
            tailwind("text-text mb-lg"),
            { fontSize: 28, lineHeight: 34, fontWeight: "700" },
          ]}
          maxFontSizeMultiplier={1.4}
        >
          Welcome to PetPals Connect
        </WalkthroughableText>
      </CopilotStep>

      <View style={tailwind("flex-row justify-between mb-xl")}>
        {SHORTCUTS.map((shortcut) => (
          <WalkthroughableTouchableOpacity
            key={shortcut.route}
            testID={`shortcut-${shortcut.route}`}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
            onPress={() => navigation.navigate(shortcut.route)}
            style={tailwind("items-center")}
          >
            <View style={tailwind("bg-primarySoft rounded-card p-md mb-xs")}>
              <Ionicons name={shortcut.icon} size={22} color={tokens.primary} />
            </View>
            <Text variant="caption" tone="muted">
              {shortcut.label}
            </Text>
          </WalkthroughableTouchableOpacity>
        ))}
      </View>

      <CopilotStep text="Check out the latest pets here" order={3} name="latestPets">
        <View style={tailwind("mb-xl")}>
          <WalkthroughableText
            style={[
              tailwind("text-text mb-sm"),
              { fontSize: 20, lineHeight: 26, fontWeight: "600" },
            ]}
            maxFontSizeMultiplier={1.5}
          >
            Latest Pets
          </WalkthroughableText>

          {loading ? (
            <PetShelfSkeleton />
          ) : latestPets.length === 0 ? (
            <Text tone="muted">No pets to show yet. Check back soon.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {latestPets.map((pet) => (
                <WalkthroughableTouchableOpacity
                  key={pet._id}
                  testID={`pet-${pet._id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${pet.name}, open profile`}
                  onPress={() => navigation.navigate("PetDetails", { petId: pet._id })}
                  style={tailwind("mr-md")}
                >
                  {petPhoto(pet) ? (
                    <WalkthroughableImage
                      source={{ uri: petPhoto(pet) }}
                      style={tailwind("h-32 w-32 rounded-card")}
                    />
                  ) : (
                    <View
                      style={tailwind(
                        "h-32 w-32 rounded-card bg-surfaceAlt items-center justify-center"
                      )}
                    >
                      <Ionicons name="paw-outline" size={28} color={tokens.textFaint} />
                    </View>
                  )}
                  <Text variant="caption" align="center" style={tailwind("mt-xs")}>
                    {pet.name}
                  </Text>
                </WalkthroughableTouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </CopilotStep>

      <CopilotStep text="Your favorite pets and places are here" order={4} name="favorites">
        <View style={tailwind("mb-xl")}>
          <WalkthroughableText
            style={[
              tailwind("text-text mb-sm"),
              { fontSize: 20, lineHeight: 26, fontWeight: "600" },
            ]}
            maxFontSizeMultiplier={1.5}
          >
            Your Favorites
          </WalkthroughableText>

          {loading ? (
            <View testID="home-favorites-loading">
              <Skeleton width="60%" height={16} />
              <View style={{ height: space.md }} />
              <Skeleton width="45%" height={16} />
            </View>
          ) : favorites.length === 0 ? (
            <Text tone="muted">
              Nothing saved yet. Tap the heart on a pet to keep it here.
            </Text>
          ) : (
            favorites.map((favorite) => (
              <TouchableOpacity
                key={favorite._id}
                testID={`favorite-${favorite._id}`}
                accessibilityRole="button"
                accessibilityLabel={favorite.pet?.name ?? "Saved item"}
                onPress={() =>
                  favorite.pet &&
                  navigation.navigate("PetDetails", { petId: favorite.pet._id })
                }
                // The row was `py-2` - 8pt of padding around a line of text, so
                // roughly 28pt of target against a 44pt floor.
                style={tailwind("py-md justify-center")}
              >
                <Text>{favorite.pet?.name ?? "Saved item"}</Text>
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
          accessibilityRole="button"
          accessibilityLabel="Open the map"
          onPress={() => navigation.navigate("Map")}
          style={tailwind("items-center justify-center mb-xl py-md")}
        >
          <Ionicons name="map-outline" size={28} color={tokens.text} />
          <Text style={tailwind("mt-xs")}>Open the map</Text>
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
          <Button
            testID="home-all-articles"
            title="View all articles"
            variant="soft"
            onPress={() => navigation.navigate("Articles")}
            style={tailwind("mt-sm")}
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
    </Screen>
  );
};

export default copilot({ tooltipComponent: CustomTooltip })(HomeScreen);

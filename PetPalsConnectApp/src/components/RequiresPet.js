import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../styles/tailwind";
import { useAuthSession } from "../context/AuthSessionContext";
import { useTokens } from "../context/AppThemeContext";

/**
 * Renders `children` only when the user has a pet the screen can work with.
 *
 * The add-a-pet step during onboarding is skippable, so reaching the app no
 * longer guarantees a pet exists. Rather than scattering `pets.length === 0`
 * branches through every screen, the screens that genuinely need a pet wrap
 * themselves in this and get one consistent, actionable empty state.
 *
 * `species` narrows what counts. A profile can hold a cat or a rabbit so the
 * care hub has something to work from, but playdates are dogs only - so a
 * matching screen passes `species="dog"` and a cat-only owner gets the same
 * clear empty state a petless one does, instead of a deck that is silently
 * always empty. Screens that work with any pet leave it unset.
 *
 * Screens that merely *display* pets (a list, a profile) do not need this - an
 * ordinary empty list is fine there. Use it where the screen cannot function
 * at all: matching, playdate scheduling, starting a chat.
 */
export function RequiresPet({
  children,
  species,
  title = "Add a pet first",
  message = "This part of PetPals works from your pet's profile. Add one and you're in.",
}) {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const navigation = useNavigation();
  const { hasPet, hasDog } = useAuthSession();

  // Only one species is matchable, so this is the only distinction to draw.
  // If that ever stops being true it becomes a lookup rather than a ternary.
  if (species === "dog" ? hasDog : hasPet) return children;

  return (
    <View
      testID="requires-pet-empty-state"
      style={tailwind("flex-1 items-center justify-center px-8 bg-surface")}
    >
      <Ionicons name="paw-outline" size={56} color={tokens.textFaint} />
      <Text
        testID="requires-pet-title"
        style={tailwind("text-xl font-bold text-text mt-5 text-center")}
      >
        {title}
      </Text>
      <Text testID="requires-pet-message" style={tailwind("text-center text-textMuted mt-2 mb-6")}>
        {message}
      </Text>

      <Pressable
        testID="requires-pet-add-button"
        onPress={() => navigation.navigate("AddPet")}
        style={tailwind("bg-danger rounded-lg py-3 px-8")}
      >
        <Text style={tailwind("text-onPrimary font-semibold")}>
          {species === "dog" ? "Add my dog" : "Add my pet"}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Screen-level wrapper, applied where screens are registered so the screen
 * files themselves stay focused on their own job.
 */
export const withRequiredPet = (Component, options) => {
  const Wrapped = (props) => (
    <RequiresPet {...options}>
      <Component {...props} />
    </RequiresPet>
  );
  Wrapped.displayName = `withRequiredPet(${
    Component.displayName || Component.name || "Screen"
  })`;
  return Wrapped;
};

export default RequiresPet;

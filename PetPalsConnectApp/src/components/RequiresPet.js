import React from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../styles/tailwind";
import { useAuthSession } from "../context/AuthSessionContext";

/**
 * Renders `children` only when the user has at least one pet.
 *
 * The add-a-pet step during onboarding is skippable, so reaching the app no
 * longer guarantees a pet exists. Rather than scattering `pets.length === 0`
 * branches through every screen, the screens that genuinely need a pet wrap
 * themselves in this and get one consistent, actionable empty state.
 *
 * Screens that merely *display* pets (a list, a profile) do not need this - an
 * ordinary empty list is fine there. Use it where the screen cannot function
 * at all: matching, playdate scheduling, starting a chat.
 */
export function RequiresPet({
  children,
  title = "Add a pet first",
  message = "This part of PetPals works from your pet's profile. Add one and you're in.",
}) {
  const tailwind = useTailwind();
  const navigation = useNavigation();
  const { hasPet } = useAuthSession();

  if (hasPet) return children;

  return (
    <View style={tailwind("flex-1 items-center justify-center px-8 bg-white")}>
      <Ionicons name="paw-outline" size={56} color="#d0d0d0" />
      <Text style={tailwind("text-xl font-bold text-gray-900 mt-5 text-center")}>
        {title}
      </Text>
      <Text style={tailwind("text-center text-gray-600 mt-2 mb-6")}>{message}</Text>

      <Pressable
        onPress={() => navigation.navigate("AddPet")}
        style={tailwind("bg-red-500 rounded-lg py-3 px-8")}
      >
        <Text style={tailwind("text-white font-semibold")}>Add my pet</Text>
      </Pressable>
    </View>
  );
}

/**
 * Screen-level wrapper, applied where screens are registered so the screen
 * files themselves stay focused on their own job.
 */
export const withRequiredPet = (Component, copy) => {
  const Wrapped = (props) => (
    <RequiresPet {...copy}>
      <Component {...props} />
    </RequiresPet>
  );
  Wrapped.displayName = `withRequiredPet(${
    Component.displayName || Component.name || "Screen"
  })`;
  return Wrapped;
};

export default RequiresPet;

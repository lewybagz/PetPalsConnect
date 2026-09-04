import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthStack from "./AuthStack";
import AppStack from "./AppStack";
import CreateProfileScreen from "../auth/CreateProfileScreen";
import AddFirstPetScreen from "../pets/AddFirstPetScreen";
import usePushNotifications from "../../hooks/usePushNotifications";
import { useSocketSession } from "../../hooks/useSocketEvents";
import useSessionStore from "../../hooks/useSessionStore";
import { useAuthSession, AuthStatus } from "../../context/AuthSessionContext";

const Root = createNativeStackNavigator();

const Centered = ({ children }) => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
    {children}
  </View>
);

/**
 * Chooses the navigation tree from the auth session.
 *
 * Four trees rather than two. "Signed in" is not enough to enter the app: a
 * user also needs a profile and at least one pet, and signup can be interrupted
 * between any two of those. Gating on all three means an interrupted signup
 * lands back in onboarding on the next launch and finishes where it left off,
 * instead of being stuck in an app where every request 404s.
 *
 * The pet gate also removes an entire class of empty state. Nearly every screen
 * below here assumes the user has a pet - matching, playdates, chat all start
 * from one. Guaranteeing it at the boundary is one check instead of a "no pets
 * yet" branch in a dozen screens.
 *
 * Swapping the whole tree (rather than navigating between them) means signing
 * out cannot leave authenticated screens on the back stack.
 */
export default function RootNavigator() {
  const { status, error, refresh, signOut } = useAuthSession();

  usePushNotifications(status === AuthStatus.ready);
  // The server pushes to a room named after the Mongo user id, so this device
  // has to join it. Doing that here means every screen below inherits a live
  // connection instead of each one arranging its own.
  useSocketSession();
  // Fifteen screens read `state.user.userId` from Redux and nothing ever set
  // it. The session is the source of truth; this keeps the store in step.
  useSessionStore();

  if (status === AuthStatus.loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" />
      </Centered>
    );
  }

  // Reachable when the API is unreachable and nothing is cached. Offer a way
  // forward rather than an indefinite spinner.
  if (status === AuthStatus.error) {
    return (
      <Centered>
        <Text style={{ fontSize: 17, fontWeight: "600", marginBottom: 8 }}>
          Can&apos;t reach PetPals Connect
        </Text>
        <Text style={{ color: "#666", textAlign: "center", marginBottom: 20 }}>
          {error ?? "Check your connection and try again."}
        </Text>
        <Pressable
          onPress={refresh}
          style={{
            backgroundColor: "tomato",
            paddingVertical: 12,
            paddingHorizontal: 28,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Try again</Text>
        </Pressable>
        <Pressable onPress={signOut} style={{ marginTop: 16 }}>
          <Text style={{ color: "#888" }}>Sign out</Text>
        </Pressable>
      </Centered>
    );
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {status === AuthStatus.signedOut && (
        <Root.Screen name="Auth" component={AuthStack} />
      )}

      {status === AuthStatus.needsProfile && (
        <Root.Screen name="CreateProfile" component={CreateProfileScreen} />
      )}

      {status === AuthStatus.needsPet && (
        <Root.Screen name="AddFirstPet" component={AddFirstPetScreen} />
      )}

      {status === AuthStatus.ready && <Root.Screen name="App" component={AppStack} />}
    </Root.Navigator>
  );
}

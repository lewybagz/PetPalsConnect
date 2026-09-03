import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthStack from "./AuthStack";
import AppStack from "./AppStack";
import CreateProfileScreen from "../auth/CreateProfileScreen";
import usePushNotifications from "../../hooks/usePushNotifications";
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
 * Three trees rather than two. "Signed in" is not enough to enter the app: a
 * user also needs a profile, and signup can be interrupted between creating the
 * Firebase account and creating that profile. Gating on both means such a user
 * lands back in onboarding on the next launch and finishes where they left off,
 * instead of being stuck in an app where every request 404s.
 *
 * Swapping the whole tree (rather than navigating between them) means signing
 * out cannot leave authenticated screens on the back stack.
 */
export default function RootNavigator() {
  const { status, error, refresh, signOut } = useAuthSession();

  usePushNotifications(status === AuthStatus.ready);

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

      {status === AuthStatus.ready && <Root.Screen name="App" component={AppStack} />}
    </Root.Navigator>
  );
}

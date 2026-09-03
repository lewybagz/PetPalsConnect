import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";

import AuthStack from "./AuthStack";
import AppStack from "./AppStack";
import usePushNotifications from "../../hooks/usePushNotifications";

const Root = createNativeStackNavigator();

/**
 * Chooses between the signed-out and signed-in navigation trees based on
 * Firebase auth state, and mounts the push-notification listeners once
 * navigation is available.
 *
 * Swapping the whole tree on sign-in/sign-out (rather than navigating between
 * them) means signing out cannot leave authenticated screens on the back stack.
 */
export default function RootNavigator() {
  const [user, setUser] = useState(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (nextUser) => {
      setUser(nextUser);
      setInitialising(false);
    });
    return unsubscribe;
  }, []);

  usePushNotifications(!!user);

  if (initialising) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Root.Screen name="App" component={AppStack} />
      ) : (
        <Root.Screen name="Auth" component={AuthStack} />
      )}
    </Root.Navigator>
  );
}

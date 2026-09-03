import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import EmailAuthScreen from "../auth/EmailAuthScreen";
import LoginScreen from "../auth/LoginScreen";
import PhoneAuthScreen from "../auth/PhoneAuthScreen";
import RegisterScreen from "../auth/RegisterScreen";
import VerificationSelectionScreen from "../auth/VerificationSelectionScreen";

const Stack = createNativeStackNavigator();

/**
 * Signed-out navigation.
 *
 * Previously this stack imported RegisterScreen and VerificationSelectionScreen
 * from its own directory (they live in ../auth) and registered HomeScreen,
 * making an authenticated screen reachable without signing in. RootNavigator
 * now owns the signed-in tree, so this stack only covers authentication.
 */
export default function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
      <Stack.Screen name="VerificationSelection" component={VerificationSelectionScreen} />
    </Stack.Navigator>
  );
}

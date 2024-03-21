import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import EmailAuthScreen from "./EmailAuthScreen"; // Adjust the path to where your screen components are located
import LoginScreen from "./LoginScreen";
import PhoneAuthScreen from "./PhoneAuthScreen";
import RegisterScreen from "./RegisterScreen";
import VerificationSelectionScreen from "./VerificationSelectionScreen";

// Create the stack navigator
const Stack = createStackNavigator();

// Configure the AuthStack
const AuthStack = () => {
  return (
    <Stack.Navigator initialRouteName="LoginScreen">
      <Stack.Screen
        name="EmailAuth"
        component={EmailAuthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneAuth"
        component={PhoneAuthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VerificationSelection"
        component={VerificationSelectionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;

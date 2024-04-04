import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "../bottomTab/HomeScreen";
import EmailAuthScreen from "../auth/EmailAuthScreen";
import LoginScreen from "../auth/LoginScreen";
import PhoneAuthScreen from "../auth/PhoneAuthScreen";
import RegisterScreen from "./RegisterScreen";
import VerificationSelectionScreen from "./VerificationSelectionScreen";

const Stack = createStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator initialRouteName="LoginScreen" gestureEnabled:true>
      <Stack.Screen
        name="EmailAuth"
        component={EmailAuthScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
        gestureEnabled:false
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
      <Stack.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;

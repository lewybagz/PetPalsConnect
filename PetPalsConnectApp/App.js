import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { Provider as ReduxProvider } from "react-redux";

import store from "./src/redux/store";
import { AppThemeProvider } from "./src/context/AppThemeContext";
import RootNavigator from "./src/screens/navigation/RootNavigator";
import { navigationRef } from "./src/navigation/navigationRef";

/**
 * Application root.
 *
 * The previous version called `useNavigation()` at this level - outside any
 * NavigationContainer - which throws on the first render, and rendered stack
 * navigators as direct children of a Stack.Navigator, which React Navigation
 * rejects. Navigation-dependent work (push notification routing, the hardware
 * back handler) now lives inside RootNavigator, below the container.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <AppThemeProvider>
          <SafeAreaProvider>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="auto" />
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </AppThemeProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { Provider as ReduxProvider } from "react-redux";

import store from "./src/redux/store";
import { AppThemeProvider, useAppTheme } from "./src/context/AppThemeContext";
import { ToastProvider } from "./src/components/ui/Toast";
import { AuthSessionProvider } from "./src/context/AuthSessionContext";
import RootNavigator from "./src/screens/navigation/RootNavigator";
import PaymentsProvider from "./src/components/PaymentsProvider";
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
/**
 * `style="auto"` follows the *system* scheme, which is wrong the moment
 * somebody pins the app to a theme the OS is not using: dark bars on a light
 * app, or invisible ones on a dark app.
 */
const ThemedStatusBar = () => {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <AppThemeProvider>
          <AuthSessionProvider>
            <PaymentsProvider>
              <SafeAreaProvider>
                {/* Inside the safe-area provider because the toast positions
                    itself above the home indicator, and outside the navigator
                    so one host serves every screen. */}
                <ToastProvider>
                  <NavigationContainer ref={navigationRef}>
                    <ThemedStatusBar />
                    <RootNavigator />
                  </NavigationContainer>
                </ToastProvider>
              </SafeAreaProvider>
            </PaymentsProvider>
          </AuthSessionProvider>
        </AppThemeProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

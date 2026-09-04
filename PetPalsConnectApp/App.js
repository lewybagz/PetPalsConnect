import React, { useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { Provider as ReduxProvider } from "react-redux";

import store from "./src/redux/store";
import { AppThemeProvider, useAppTheme } from "./src/context/AppThemeContext";
import { ToastProvider } from "./src/components/ui/Toast";
import { AuthSessionProvider } from "./src/context/AuthSessionContext";
import RootNavigator from "./src/screens/navigation/RootNavigator";
import PaymentsProvider from "./src/components/PaymentsProvider";
import { navigationRef } from "./src/navigation/navigationRef";
import { useAppFonts } from "./src/styles/fonts";

/**
 * Held until the faces are on the device, so the first frame is not a flash of
 * the system font reflowing into Nunito. `catch` because a splash screen that
 * refuses to be held is not a reason to fail the launch.
 */
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  // "Settled", not "loaded": a typeface that fails to download must never stop
  // the app from opening, so an error renders in the system face instead.
  const fontsSettled = useAppFonts();

  const onReady = useCallback(() => {
    if (fontsSettled) SplashScreen.hideAsync().catch(() => {});
  }, [fontsSettled]);

  if (!fontsSettled) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onReady}>
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

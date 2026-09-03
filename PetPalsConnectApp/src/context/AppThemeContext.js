import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * App theme.
 *
 * App.js and SettingsScreen both imported a theme context that did not exist in
 * the repository, so the app crashed at module load. This is that provider.
 *
 * "system" follows the OS setting; "light"/"dark" pin it. The choice persists
 * across launches.
 */

const STORAGE_KEY = "@petpals/theme-preference";

const AppThemeContext = createContext({
  theme: "light",
  preference: "system",
  setPreference: () => {},
  isDark: false,
});

export const AppThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && stored) setPreferenceState(stored);
      })
      .catch((error) => console.warn("[theme] Could not read preference:", error.message))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) =>
      console.warn("[theme] Could not persist preference:", error.message)
    );
  }, []);

  const value = useMemo(() => {
    const theme = preference === "system" ? systemScheme || "light" : preference;
    return {
      theme,
      preference,
      setPreference,
      // SettingsScreen drives a plain light/dark switch.
      toggleAppTheme: () => setPreference(theme === "dark" ? "light" : "dark"),
      isDark: theme === "dark",
      hydrated,
    };
  }, [preference, systemScheme, setPreference, hydrated]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = () => useContext(AppThemeContext);

// SettingsScreen imported this under the name ThemeContext.
export const ThemeContext = AppThemeContext;

export default AppThemeContext;

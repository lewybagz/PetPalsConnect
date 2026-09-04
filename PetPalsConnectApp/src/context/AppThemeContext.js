import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { palettes } from "../styles/tokens";

/**
 * App theme.
 *
 * App.js and SettingsScreen both imported a theme context that did not exist in
 * the repository, so the app crashed at module load. This is that provider.
 *
 * "system" follows the OS setting; "light"/"dark" pin it. The choice persists
 * across launches.
 *
 * It also shipped a dark-mode switch that changed nothing but its own thumb.
 * That was structural rather than lazy: with 185 hardcoded hex literals and no
 * token layer there was nothing for a theme to switch. `palette` is what there
 * is to switch now - `useTailwind()` resolves its classes against it, so a
 * screen gets dark mode without mentioning it.
 */

const STORAGE_KEY = "@petpals/theme-preference";

const AppThemeContext = createContext({
  theme: "light",
  preference: "system",
  setPreference: () => {},
  isDark: false,
  palette: palettes.light,
});

/**
 * `initialPreference` pins the theme instead of reading the stored one. Only
 * the screenshot gallery passes it, so that one page can show both palettes
 * side by side; the app itself always starts from "system" and the saved value.
 */
export const AppThemeProvider = ({ children, initialPreference }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState(initialPreference ?? "system");
  // Nothing to read when the theme is pinned, so it starts hydrated rather
  // than setting state from inside the effect below.
  const [hydrated, setHydrated] = useState(Boolean(initialPreference));

  useEffect(() => {
    if (initialPreference) return undefined;

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
  }, [initialPreference]);

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
      // The active token set. Primitives read colours from here; everything
      // else goes through `useTailwind()`, which is bound to the same palette.
      palette: palettes[theme] ?? palettes.light,
      hydrated,
    };
  }, [preference, systemScheme, setPreference, hydrated]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = () => useContext(AppThemeContext);

/**
 * The active palette, for the handful of places that need a raw colour rather
 * than a class - an icon's `color` prop, an `ActivityIndicator`, a shadow.
 */
export const useTokens = () => useAppTheme().palette;

// SettingsScreen imported this under the name ThemeContext.
export const ThemeContext = AppThemeContext;

export default AppThemeContext;

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The settings that belong to a phone rather than to an account.
 *
 * Theme is already here (`AppThemeContext` owns it, and has since dark mode
 * became real); these are its neighbours. None of them is anything the server
 * has a use for, and syncing them would put a round trip and a failure mode in
 * front of a switch that has to feel instant - which is how a settings screen
 * starts feeling broken even when every save succeeds.
 *
 * They also have to survive being read before they are loaded. A screen asking
 * "is reduced motion on?" during the first frame gets the default, not
 * `undefined`, because the alternative is every animated screen branching on a
 * third state that exists for about eighty milliseconds.
 *
 * There are three of them and not eight on purpose. A haptics switch and an
 * autoplay switch were both drafted here and both cut, because this app has no
 * haptics and no video: a setting that is stored and not honoured is the same
 * class of bug as blocking being a model nothing queried, and a settings screen
 * full of them is worse than a short one. Each of these three changes something
 * you can see, and `DisplaySettingsScreen.test.js` is what keeps that true.
 */

const STORAGE_KEY = "@petpals/device-preferences";

export const DEFAULTS = {
  /**
   * Honour the OS "Reduce Motion" switch as well as this one - somebody who
   * has set it system-wide should not have to find it again in here. The app
   * reads `AccessibilityInfo` where it animates; this is the app-level
   * override for a device that has not set it.
   */
  reduceMotion: false,
  /**
   * Bumps every text role. `Text` already caps Dynamic Type per role, so this
   * is a multiplier on top of what the OS asks for, for somebody who wants the
   * app larger without making their whole phone larger.
   */
  largerText: false,
  /** Shows the match score on a Discover card. Off is a calmer deck. */
  showMatchScore: true,
};

const DevicePreferencesContext = createContext(null);

/**
 * `initialPreferences` pins them rather than reading storage. Only the gallery
 * passes it, so a board can show "larger text" without a cache write.
 */
export const DevicePreferencesProvider = ({ children, initialPreferences }) => {
  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULTS,
    ...(initialPreferences ?? {}),
  }));

  useEffect(() => {
    if (initialPreferences) return undefined;

    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        // Merged over the defaults rather than replacing them, so a preference
        // added after somebody last saved does not come back undefined.
        setPreferences({ ...DEFAULTS, ...JSON.parse(stored) });
      })
      .catch((error) =>
        console.warn("[device preferences] Could not read:", error.message)
      );

    return () => {
      cancelled = true;
    };
  }, [initialPreferences]);

  const set = useCallback((key, value) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      // Fire and forget: the switch has already moved, and a failed write
      // means the preference is lost at next launch, not that it is wrong now.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) =>
        console.warn("[device preferences] Could not persist:", error.message)
      );
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULTS);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ preferences, set, reset }),
    [preferences, set, reset]
  );

  return (
    <DevicePreferencesContext.Provider value={value}>
      {children}
    </DevicePreferencesContext.Provider>
  );
};

/**
 * Deliberately does not throw without a provider. These are conveniences, and
 * a card asking whether to animate is not somewhere to crash.
 */
export const useDevicePreferences = () =>
  useContext(DevicePreferencesContext) ?? {
    preferences: DEFAULTS,
    set: () => {},
    reset: () => {},
  };

export { DevicePreferencesContext };

export default DevicePreferencesContext;

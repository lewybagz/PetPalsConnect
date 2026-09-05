import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { fetchSettings, saveSettings } from "../api/settings";
import { AuthSessionContext } from "./AuthSessionContext";
import { CacheKeys, readCache, writeCache } from "../services/localCache";
import { DEFAULT_UNITS } from "../utils/units";

/**
 * The account's settings, once, for every screen that reads one.
 *
 * A pet card, the swipe deck, the map and the playdate form all render a
 * distance or a weight, and all four would otherwise fetch the unit preference
 * themselves - four requests for one small object, and four chances to render
 * "60 lb" for half a second before correcting it to "27 kg".
 *
 * Only the *account* settings live here. Theme, larger text and reduced motion
 * are properties of a phone rather than an account and live in
 * `DevicePreferencesContext`, which never touches the network: putting a round
 * trip in front of a switch that has to feel instant is how a settings screen
 * starts feeling broken.
 */

/** What a screen sees before the first response arrives, or if it never does. */
const FALLBACK = {
  playdateRange: 25,
  locationSharingEnabled: true,
  notificationsEnabled: true,
  units: DEFAULT_UNITS,
  discovery: {
    minWeight: 0,
    maxWeight: 300,
    minAge: 0,
    maxAge: 30,
    species: [],
    includeUnknownDistance: true,
  },
  privacy: {
    profileVisibility: "everyone",
    messagesFrom: "everyone",
    friendRequestsFrom: "everyone",
    discoverableInSearch: true,
    showOnMap: true,
  },
};

const SettingsContext = createContext(null);

/** Deep-merges a patch into settings, so an optimistic update keeps siblings. */
const merge = (current, patch) => {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch ?? {})) {
    next[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? merge(current?.[key] ?? {}, value)
        : value;
  }
  return next;
};

/**
 * `initialSettings` pins the values instead of fetching them. Only the
 * screenshot gallery passes it; the app always loads from the cache and then
 * the API.
 */
export const SettingsProvider = ({ children, initialSettings }) => {
  /**
   * Read softly rather than through `useAuthSession`, which throws without a
   * provider: the gallery mounts this on its own to pin a board's settings, and
   * a screenshot tool is not a reason to stand up Firebase.
   *
   * The fetch waits for a signed-in caller because every route here is behind
   * `authenticate`. Asking before there is a token is one guaranteed 401 per
   * launch, and an error in the log that means nothing.
   */
  const session = useContext(AuthSessionContext);
  const enabled = session ? Boolean(session.isSignedIn) : true;

  const [settings, setSettings] = useState(() =>
    initialSettings ? merge(FALLBACK, initialSettings) : FALLBACK
  );
  const [choices, setChoices] = useState(initialSettings?.choices ?? null);
  const [loading, setLoading] = useState(!initialSettings && enabled);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchSettings();
      const { choices: loadedChoices, ...values } = data;
      setSettings(merge(FALLBACK, values));
      if (loadedChoices) setChoices(loadedChoices);
      setFailed(false);
      // Cached so the next launch renders weights and distances in the right
      // units on the first frame rather than correcting them a moment later.
      writeCache(CacheKeys.settings, values).catch(() => {});
    } catch (error) {
      console.warn("[settings] Could not load:", error.message);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (initialSettings || !enabled) return undefined;

    let cancelled = false;
    // The cache first, so there is something to render immediately; the
    // request behind it decides what is true.
    readCache(CacheKeys.settings)
      .then((cached) => {
        if (!cancelled && cached) setSettings((current) => merge(current, cached));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) load();
      });

    return () => {
      cancelled = true;
    };
  }, [initialSettings, enabled, load]);

  /**
   * Saves a partial patch, optimistically.
   *
   * The switch moves at once and snaps back if the server refuses. A control
   * that stays where it was put while the server disagrees is exactly the lie
   * the old Privacy screen told, and the reason a setting has to be readable
   * back off the server before it can be believed.
   */
  const update = useCallback(
    async (patch) => {
      const previous = settings;
      setSettings((current) => merge(current, patch));

      try {
        const data = await saveSettings(patch);
        const { choices: savedChoices, ...values } = data;
        setSettings(merge(FALLBACK, values));
        if (savedChoices) setChoices(savedChoices);
        writeCache(CacheKeys.settings, values).catch(() => {});
        return { ok: true };
      } catch (error) {
        setSettings(previous);
        return {
          ok: false,
          // A 400 from the validator names the setting and says why, which is
          // more useful than "something went wrong".
          message:
            error.response?.data?.message ?? "Couldn't save that. Try again.",
        };
      }
    },
    [settings]
  );

  const value = useMemo(
    () => ({
      settings,
      // The single most-read setting, hoisted so a card can say
      // `const units = useUnits()` rather than reaching two levels in.
      units: settings.units ?? DEFAULT_UNITS,
      choices,
      loading,
      failed,
      reload: load,
      update,
    }),
    [settings, choices, loading, failed, load, update]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

/**
 * Settings, with defaults.
 *
 * Deliberately does not throw without a provider: a pet card rendering a weight
 * is not a good place to crash, and the fallback is the same value the server
 * would have sent for an account that has never changed anything.
 */
export const useSettings = () =>
  useContext(SettingsContext) ?? {
    settings: FALLBACK,
    units: DEFAULT_UNITS,
    choices: null,
    loading: false,
    failed: false,
    reload: () => {},
    update: async () => ({ ok: false, message: "Settings are not available." }),
  };

/** Just the unit preference, which is what most callers want. */
export const useUnits = () => useSettings().units;

export { SettingsContext, FALLBACK as DEFAULT_SETTINGS };

export default SettingsContext;

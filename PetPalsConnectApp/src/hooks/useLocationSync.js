import { useEffect } from "react";
import * as Location from "expo-location";

import api from "../api/axios";
import { useAuthSession } from "../context/AuthSessionContext";

/**
 * Tells the server where this device is, once per session.
 *
 * Discovery filters candidates by distance, and `playdateRange` finally means
 * something - but only if the server knows where you are. Nothing ever sent a
 * position before, so matching was blind and the range preference was
 * decoration.
 *
 * Deliberately quiet about failure. Someone who declines the permission prompt
 * gets an unfiltered deck, which is the behaviour the app has always had; an
 * error dialog on launch for an optional feature is worse than that.
 */
const useLocationSync = (enabled) => {
  const { userId } = useAuthSession();

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        // Never asks on its own: `getForegroundPermissionsAsync` reads the
        // current answer, so the prompt appears where the user asked for
        // something location-shaped (the map, scheduling a playdate) rather
        // than in their face on launch.
        const existing = await Location.getForegroundPermissionsAsync();
        if (!existing.granted || cancelled) return;

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        await api.put("/api/users/me/location", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (error) {
        if (!cancelled) console.warn("[location] sync skipped:", error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);
};

export default useLocationSync;

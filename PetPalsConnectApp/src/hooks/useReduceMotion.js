import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { useDevicePreferences } from "../context/DevicePreferencesContext";

/**
 * Whether to hold the animation back.
 *
 * Two sources, either of which is enough. Somebody who has set "Reduce Motion"
 * on their phone has already answered this question and should not have to find
 * it again inside an app - and somebody who has *not* set it system-wide, but
 * would rather this particular app stopped throwing cards around, needs a
 * switch of their own. `AccessibilityInfo` is the OS half; the app's own
 * preference is the other.
 *
 * It is a hook rather than a value because the OS setting can change while the
 * app is open - the iOS Control Centre and the Android quick settings both do
 * it - and a card that keeps flying until the next launch is not honouring
 * anything.
 */
export const useReduceMotion = () => {
  const { preferences } = useDevicePreferences();
  const [systemAsks, setSystemAsks] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (!cancelled) setSystemAsks(Boolean(enabled));
      })
      // Not every platform answers - react-native-web among them. A missing
      // answer is "no", never a crash inside a card's render.
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => setSystemAsks(Boolean(enabled))
    );

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return systemAsks || preferences.reduceMotion;
};

export default useReduceMotion;

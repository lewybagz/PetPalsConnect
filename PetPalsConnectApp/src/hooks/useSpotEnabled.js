import { useEffect, useState } from "react";

import { fetchSpotStatus } from "../api/spot";

/**
 * Whether Spot is on for this server, for the screens that offer it.
 *
 * Asked once per app session and remembered: six screens carry an Ask Spot
 * button and the hub and Home carry an entry, and none of them should cost a
 * request. `null` means not yet known, and a caller renders nothing for it -
 * a button that appears and then vanishes is worse than one that arrives a
 * frame late. Spot being off is an ordinary state, not an error, the same
 * as the plan picker with no RevenueCat keys.
 */
let known = null;
let inflight = null;

const ask = () => {
  if (known !== null) return Promise.resolve(known);
  if (!inflight) {
    inflight = fetchSpotStatus()
      .then((status) => {
        known = Boolean(status.enabled);
        return known;
      })
      .catch(() => {
        // Unknown stays unknown: the next screen asks again.
        inflight = null;
        return null;
      });
  }
  return inflight;
};

export const useSpotEnabled = () => {
  const [enabled, setEnabled] = useState(known);

  useEffect(() => {
    if (known !== null) return undefined;
    let cancelled = false;
    ask().then((value) => {
      if (!cancelled && value !== null) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
};

/** Forgets the answer, so a test or a sign-out asks afresh. */
export const resetSpotEnabled = () => {
  known = null;
  inflight = null;
};

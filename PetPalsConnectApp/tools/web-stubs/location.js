/**
 * `expo-location` in a headless browser.
 *
 * Chromium neither grants nor refuses geolocation without a user gesture, so
 * the real module leaves the map screen waiting on a promise that never
 * settles - and a screenshot of "Finding what's near you…" is not a screenshot
 * of the map.
 *
 * Refusing is the honest answer: the browser genuinely has no position here,
 * and it exercises the path that matters most anyway - the pins come from the
 * server's record of where the caller last was, so only the blue dot is lost.
 *
 * Refused *permanently* (`canAskAgain: false`), because `services/location.js`
 * shows its pre-permission disclosure - an Alert awaiting a tap - to anybody
 * who has not answered yet, and nobody taps in a headless browser. A "denied"
 * with no `canAskAgain` read as "not answered yet", and the map board sat on
 * "Finding what's near you…" forever.
 */
const refused = { status: "denied", granted: false, canAskAgain: false };
export const requestForegroundPermissionsAsync = async () => refused;
export const getForegroundPermissionsAsync = async () => refused;
export const getCurrentPositionAsync = async () => {
  throw new Error("Location is not available in the gallery");
};
export const reverseGeocodeAsync = async () => [];
export const Accuracy = { Balanced: 3, High: 4 };

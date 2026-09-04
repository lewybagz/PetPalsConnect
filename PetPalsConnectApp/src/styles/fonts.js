import { isLoaded, useFonts } from "expo-font";
import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

/**
 * The app's voice.
 *
 * Everything rendered in the system face, at nine ad-hoc sizes, with 39 of 43
 * weight declarations set to `"bold"` - an emphasis level applied so uniformly
 * that it had stopped signalling emphasis. `expo-font` was already a dependency
 * and its config plugin was already registered in `app.json`; nothing ever
 * called it.
 *
 * Type is the cheapest thing that distinguishes an app on a platform where
 * every competitor also ships San Francisco and Roboto. Nunito is rounded and
 * warm without being a novelty face, and it stays legible at caption sizes -
 * which matters here, because half this app is a name under a photograph.
 *
 * Display roles only. Body copy stays on the system face: it is what the OS
 * hints best, what Dynamic Type is tuned for, and what a long message thread
 * should be set in.
 */

/**
 * On Android `fontWeight` does not select a face - the family name does. So
 * each role names the exact loaded family rather than a family plus a weight,
 * or the heading renders regular on one platform and bold on the other.
 */
export const DISPLAY_FAMILIES = {
  display: "Nunito_800ExtraBold",
  title: "Nunito_700Bold",
  label: "Nunito_600SemiBold",
};

/**
 * The family for a text role, or `undefined` to leave the system face alone.
 *
 * Asks `expo-font` rather than keeping a flag of its own. A module-level
 * boolean would have to be written during a render - a side effect the React
 * Compiler rules reject, and rightly: it would be read by components that never
 * re-render to see it change. `isLoaded` is synchronous and is the actual
 * truth, so a component rendered on its own (which is how the tests render
 * them) correctly falls back to the system face rather than naming a family
 * the device does not have.
 */
export const displayFamily = (role) => {
  const family = DISPLAY_FAMILIES[role];
  if (!family) return undefined;

  try {
    return isLoaded(family) ? family : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Loads the faces. Resolves to `true` once the app may render.
 *
 * A font that fails to load must never stop the app from opening - the same
 * rule the payments layer follows. `useFonts` reports an error rather than
 * throwing, and this treats "errored" as "settled": the app renders in the
 * system face and nobody is locked out because a typeface was unavailable.
 */
export const useAppFonts = () => {
  const [loaded, error] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  return loaded || Boolean(error);
};

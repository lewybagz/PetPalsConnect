import { Alert } from "react-native";
import * as Location from "expo-location";

/**
 * Asks for the location permission, with the app's own explanation first.
 *
 * Google Play's User Data policy wants a "prominent disclosure" in the app -
 * what is collected, how it is used and shared - immediately before the OS
 * prompt, when the use is not one the person would expect. Showing your dog
 * to other users on a map is exactly that: the OS string can say "to find
 * matches near you" but has no room for "and other people will see roughly
 * where you are". Consent has to be an affirmative tap, and backing out must
 * not count as yes, so the sheet is not cancelable by tapping away.
 *
 * Asked once: a permission already granted goes straight through, and one
 * refused with "don't ask again" is not asked about at all - the disclosure is
 * for a decision the person is about to make, not a nag about one they made.
 *
 * Resolves to the permission status, so callers read it the way they read the
 * OS answer.
 */
const explain = () =>
  new Promise((resolve) => {
    Alert.alert(
      "Use your location?",
      "PetPals uses your location to show dogs, parks and vets near you and to " +
        "filter matches by distance.\n\n" +
        "Other users see your dog's approximate location - rounded to about a " +
        "kilometre - on the map. Your exact position is never shared. You can " +
        "turn the map off in Settings › Privacy, and revoke this permission in " +
        "your phone's settings at any time.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });

export const requestLocationPermission = async () => {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) return "granted";
  if (existing.canAskAgain === false) return existing.status;

  if (!(await explain())) return "denied";

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status;
};

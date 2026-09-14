import { Alert } from "react-native";
import {
  getMessaging,
  getToken,
  hasPermission,
  requestPermission,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import api from "../api/axios";
import { track } from "./analytics";

/**
 * Asks for the notification permission, with the app's own explanation first.
 *
 * This is `services/location.js` one permission over, and it exists because
 * push did not have it. `usePushNotifications` called `requestPermission` from
 * a mount effect the instant the session reached `ready` - so somebody who had
 * just finished a signup form was handed an OS dialog about notifications for
 * an app they had not used yet, with no context and no way to say "later".
 *
 * That inconsistency was the sharpest one in the codebase: `useLocationSync`
 * explicitly refuses to do this ("rather than in their face on launch") and
 * `services/location.js` builds a whole disclosure sheet to honour it. Push
 * got neither.
 *
 * **On iOS the system prompt fires once, permanently.** A "no" there cannot be
 * re-asked from inside the app - the person has to find it in Settings, which
 * nobody does. That single documented platform fact is the whole justification
 * for asking in context; Apple's own guidance says people "may not have enough
 * information to make a decision, and might reject the authorization".
 *
 * Asked once, like location: already answered goes straight through, and a
 * refusal is never nagged. The sheet is cancelable here, unlike location's -
 * there is no disclosure obligation to satisfy, so dismissing it is just
 * "later" and the next entry point can ask again.
 */
const explain = (petName) =>
  new Promise((resolve) => {
    const subject = petName ? petName : "your pet";
    Alert.alert(
      "Get told when it matters?",
      `PetPals will let you know when somebody wants to meet ${subject}, when a ` +
        "message arrives, and when a playdate is confirmed or changed.\n\n" +
        "That's all - no marketing, and nothing daily. You can change exactly " +
        "which of these you get in Settings › Notifications, or turn them all " +
        "off in your phone's settings.",
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        { text: "Turn on", onPress: () => resolve(true) },
      ]
    );
  });

const isGranted = (status) =>
  status === AuthorizationStatus.AUTHORIZED ||
  status === AuthorizationStatus.PROVISIONAL;

/**
 * Registers this device for push, if permission is already granted.
 *
 * Split out from the asking so `usePushNotifications` can keep a token current
 * on every launch without ever being the thing that prompts. A device that was
 * granted permission last week still needs its token posted today - tokens
 * rotate, and a stale one is a push that silently goes nowhere.
 */
export const registerDeviceToken = async () => {
  try {
    const instance = getMessaging();
    if (!isGranted(await hasPermission(instance))) return false;

    const token = await getToken(instance);
    if (!token) return false;

    await api.post("/api/notifications/device-token", { fcmToken: token });
    return true;
  } catch (error) {
    // Never blocks anything. A device that cannot register is a device that
    // does not get pushes, which is a smaller problem than a screen that does
    // not open.
    console.warn("[push] Registration failed:", error.message);
    return false;
  }
};

/**
 * Explains, then asks, then registers.
 *
 * Resolves to the status string the caller can act on:
 *   "granted"   - permission held, token posted
 *   "denied"    - the person said no, here or to the OS
 *   "postponed" - "Not now"; the OS was never asked, so this can be asked again
 *   "blocked"   - denied previously at OS level; asking again does nothing
 *
 * `postponed` and `denied` are deliberately different. Only the first is worth
 * offering again later, and conflating them either nags somebody who said no
 * or silently gives up on somebody who said "later".
 */
export const requestPushPermission = async ({ petName } = {}) => {
  try {
    const instance = getMessaging();
    const existing = await hasPermission(instance);

    if (isGranted(existing)) {
      await registerDeviceToken();
      return "granted";
    }

    // Already refused at the OS level. Asking again shows nothing on iOS, so
    // the honest answer is that this is not ours to fix from here.
    if (existing === AuthorizationStatus.DENIED) return "blocked";

    track("push_primer_shown");

    if (!(await explain(petName))) {
      track("push_permission_result", { result: "postponed" });
      return "postponed";
    }

    const status = await requestPermission(instance);
    const granted = isGranted(status);

    track("push_permission_result", { result: granted ? "granted" : "denied" });

    if (!granted) return "denied";

    await registerDeviceToken();
    return "granted";
  } catch (error) {
    console.warn("[push] Permission request failed:", error.message);
    return "denied";
  }
};

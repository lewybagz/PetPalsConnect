import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from "@react-native-firebase/messaging";

import { navigate } from "../navigation/navigationRef";
import { useToast } from "../components/ui";
import { registerDeviceToken } from "../services/pushPermission";
import { destinationFor, fetchUnreadCount } from "../api/notifications";
import { setUnreadCount } from "../redux/actions";

/**
 * Maps a notification payload to a destination screen.
 *
 * This was a second, private table written against the push payloads, so a
 * `petMatch` - the one push in the app both people are waiting on - fell
 * through to `default` and did nothing, and a stored notification tapped in the
 * list routed by different rules or not at all. `src/api/notifications.js`
 * holds the one table now, mirrored from the server's.
 */
const routeForNotification = (remoteMessage) =>
  destinationFor(remoteMessage?.data ?? {});

const openNotification = (remoteMessage) => {
  const [screen, params] = routeForNotification(remoteMessage);
  navigate(screen, params);
};

/**
 * Keeps this device's push token current and routes taps to the right screen.
 *
 * It deliberately does **not** ask for the permission. It used to: this effect
 * called `requestPermission` the moment the session reached `ready`, so the OS
 * dialog landed on somebody who had just finished a signup form and had not
 * seen the app yet. On iOS that prompt fires once, permanently, so a "no"
 * there was unrecoverable from inside the app forever - and push is how every
 * re-engagement mechanism here reaches anybody.
 *
 * `services/pushPermission.js` owns the asking now, in context, with the app's
 * own explanation first - the same shape `services/location.js` already used
 * for the location permission, which this was the odd one out against.
 *
 * Registering the token still happens on every launch, because tokens rotate
 * and a stale one is a push that silently goes nowhere. `registerDeviceToken`
 * checks the permission and does nothing without it, so it never prompts.
 *
 * Only runs while signed in - a token registered for a signed-out user would
 * attach to nobody.
 */
export default function usePushNotifications(enabled) {
  const toast = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled) return undefined;

    const instance = getMessaging();

    // No prompt: this posts a token only where permission is already held.
    registerDeviceToken();

    // Foreground message: surface it rather than silently dropping it.
    //
    // This was `Alert.alert` - a modal that stops the app and looks like an OS
    // error, for "you matched!". A toast says it and gets out of the way, and
    // tapping it goes where the notification points.
    const unsubscribeOnMessage = onMessage(instance, async (remoteMessage) => {
      const { title, body } = remoteMessage.notification ?? {};

      // The badge has to move whether or not the person taps anything.
      fetchUnreadCount()
        .then((unread) => dispatch(setUnreadCount(unread)))
        .catch(() => {});

      if (title || body) {
        toast.show(body || title, {
          actionLabel: "View",
          onAction: () => openNotification(remoteMessage),
        });
      }
    });

    // Tapped while the app was backgrounded.
    const unsubscribeOnOpen = onNotificationOpenedApp(instance, openNotification);

    // Tapped while the app was terminated.
    getInitialNotification(instance).then((remoteMessage) => {
      if (remoteMessage) openNotification(remoteMessage);
    });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnOpen();
    };
  }, [enabled, dispatch, toast]);
}

export { routeForNotification };

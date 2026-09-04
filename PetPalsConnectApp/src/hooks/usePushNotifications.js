import { useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";

import { navigate } from "../navigation/navigationRef";
import api from "../api/axios";
import { useToast } from "../components/ui";
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
 * Registers for push notifications and routes taps to the right screen.
 *
 * Only runs while signed in - registering a device token for a signed-out user
 * would attach it to nobody, and the previous implementation fired on every
 * app start regardless of auth state.
 */
export default function usePushNotifications(enabled) {
  const toast = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const instance = getMessaging();

    const register = async () => {
      try {
        const status = await requestPermission(instance);
        const granted =
          status === AuthorizationStatus.AUTHORIZED ||
          status === AuthorizationStatus.PROVISIONAL;

        if (!granted) {
          console.warn("[push] Permission not granted:", status);
          return;
        }

        const token = await getToken(instance);
        if (token && !cancelled) {
          await api.post("/api/notifications/device-token", { fcmToken: token });
        }
      } catch (error) {
        // A failed registration should never block app start.
        console.warn("[push] Registration failed:", error.message);
      }
    };

    register();

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
      cancelled = true;
      unsubscribeOnMessage();
      unsubscribeOnOpen();
    };
  }, [enabled, dispatch, toast]);
}

export { routeForNotification };

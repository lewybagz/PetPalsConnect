import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import messaging, {
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

/**
 * Maps a notification payload to a destination screen.
 * Route names must match the screens registered in AppStack.
 */
const routeForNotification = (remoteMessage) => {
  const data = remoteMessage?.data ?? {};

  switch (data.type) {
    case "friendRequest":
      return ["FriendRequests", { requesterId: data.requesterId }];
    case "message":
      return ["Chat", { chatId: data.chatId }];
    case "playdate":
      return ["PlaydateDetails", { playdateId: data.playdateId }];
    case "reviewReminder":
      return ["PostPlaydateReview", { playdateId: data.playdateId }];
    case "general":
      return ["Notifications", { notificationId: data.notificationId }];
    default:
      return null;
  }
};

const openNotification = (remoteMessage) => {
  const target = routeForNotification(remoteMessage);
  if (target) navigate(target[0], target[1]);
};

/**
 * Registers for push notifications and routes taps to the right screen.
 *
 * Only runs while signed in - registering a device token for a signed-out user
 * would attach it to nobody, and the previous implementation fired on every
 * app start regardless of auth state.
 */
export default function usePushNotifications(enabled) {
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
    const unsubscribeOnMessage = onMessage(instance, async (remoteMessage) => {
      const { title, body } = remoteMessage.notification ?? {};
      if (title || body) {
        Alert.alert(title ?? "Notification", body ?? "", [
          { text: "Dismiss", style: "cancel" },
          { text: "View", onPress: () => openNotification(remoteMessage) },
        ]);
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
  }, [enabled]);
}

export { routeForNotification };

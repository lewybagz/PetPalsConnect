/** `@react-native-firebase/messaging` has no web build. */
const messaging = () => ({
  requestPermission: async () => 0,
  getToken: async () => null,
  onMessage: () => () => {},
  onNotificationOpenedApp: () => () => {},
  getInitialNotification: async () => null,
});
messaging.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
export default messaging;
export const getMessaging = messaging;

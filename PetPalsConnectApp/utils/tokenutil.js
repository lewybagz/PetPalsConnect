import { getAuth } from "@react-native-firebase/auth";

import api from "../src/api/axios";

/**
 * Returns a valid Firebase ID token, or null when signed out.
 *
 * Previously this read a token that LoginScreen wrote to SecureStore under one
 * key while this file read a different key from AsyncStorage, so it always
 * returned null. Reading straight from the Firebase SDK removes the mismatch
 * and gets automatic refresh for free - tokens expire after an hour, and the
 * cached copy was never renewed.
 *
 * Note: `api` (src/api/axios) already attaches this header to every request.
 * This helper exists for the call sites that build their own requests.
 */
export const getStoredToken = async () => {
  const user = getAuth().currentUser;
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch (error) {
    console.warn("[auth] Could not get ID token:", error.message);
    return null;
  }
};

/** Registers this device's FCM token against the signed-in user. */
export const sendTokenToServer = async (fcmToken) => {
  try {
    const { data } = await api.post("/api/notifications/device-token", { fcmToken });
    return data;
  } catch (error) {
    console.warn("[push] Could not register device token:", error.message);
    return null;
  }
};

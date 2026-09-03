import { Platform } from "react-native";

/**
 * Runtime configuration.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time. Anything read here is
 * embedded in the shipped bundle and is therefore PUBLIC - never put a secret
 * in one of these variables.
 */

const devFallbackHost = Platform.select({
  // The Android emulator reaches the host machine on 10.0.2.2, not localhost.
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000",
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL || devFallbackHost;

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    `[config] EXPO_PUBLIC_API_URL is not set; falling back to ${devFallbackHost}. ` +
      `On a physical device set it to your machine's LAN IP in .env.`
  );
}

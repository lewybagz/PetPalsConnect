import { Platform } from "react-native";

/**
 * Runtime configuration.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time. Anything read here is
 * embedded in the shipped bundle and is therefore PUBLIC - never put a secret
 * in one of these variables.
 */

const devFallbackHost: string = Platform.select({
  // The Android emulator reaches the host machine on 10.0.2.2, not localhost.
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000",
});

export const API_URL: string = process.env.EXPO_PUBLIC_API_URL || devFallbackHost;

export const GOOGLE_WEB_CLIENT_ID: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// RevenueCat's public SDK key for this platform. Each variable is named in
// full because Metro inlines `process.env.EXPO_PUBLIC_*` by exact reference.
export const REVENUECAT_API_KEY: string | undefined = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    `[config] EXPO_PUBLIC_API_URL is not set; falling back to ${devFallbackHost}. ` +
      `On a physical device set it to your machine's LAN IP in .env.`
  );
}

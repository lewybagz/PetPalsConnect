const fs = require("fs");
const os = require("os");
const path = require("path");

const { expo } = require("../app.json");
const { reversedClientId, withGoogleSignIn } = require("../app.config");

/**
 * The parts of `app.json` a device build needs and nothing else checks.
 *
 * A capability that is used in code but not declared here fails on a phone
 * and nowhere else: `expo export` resolves imports, jest mocks the native
 * module, and the missing entitlement only shows up when a reviewer taps the
 * button. So the declarations the code depends on are asserted alongside the
 * code that depends on them - and the permission strings the code does *not*
 * depend on are asserted absent, because a reviewer reads those too.
 */
const plugin = (name) =>
  expo.plugins.find((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);
const pluginOptions = (name) => (Array.isArray(plugin(name)) ? plugin(name)[1] : {});

describe("app.json", () => {
  it("declares Sign in with Apple, which the auth screens offer", () => {
    expect(expo.ios.usesAppleSignIn).toBe(true);
  });

  it("uses one bundle id on both platforms", () => {
    expect(expo.ios.bundleIdentifier).toBe(expo.android.package);
  });

  it("can receive a push on iOS", () => {
    // Without both, `getToken()` throws "No APNS token" on every iPhone and
    // nothing in `usePushNotifications` ever registers. Expo stopped adding
    // the entitlement automatically in SDK 51.
    expect(expo.ios.entitlements["aps-environment"]).toBe("production");
    expect(expo.ios.infoPlist.UIBackgroundModes).toContain("remote-notification");
  });

  it("locks portrait on iPad honestly", () => {
    // A tablet build that locks orientation without declaring full screen is
    // an App Store rejection.
    if (expo.orientation === "portrait" && expo.ios.supportsTablet) {
      expect(expo.ios.requireFullScreen).toBe(true);
    }
  });

  it("does not claim capabilities the app never uses", () => {
    // Nothing requests background location or writes to the camera roll, and
    // the app records no audio. A usage string for an unused capability reads
    // as a lie in review. The plugins add these by default unless told not to.
    expect(expo.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    expect(expo.ios.infoPlist.NSPhotoLibraryAddUsageDescription).toBeUndefined();
    expect(pluginOptions("expo-location").locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(pluginOptions("expo-location").locationAlwaysPermission).toBe(false);
    expect(pluginOptions("expo-location").motionUsagePermission).toBe(false);
    expect(pluginOptions("expo-image-picker").microphonePermission).toBe(false);
    // expo-secure-store's plugin adds a Face ID string; the app has no
    // secure-store code.
    expect(plugin("expo-secure-store")).toBeUndefined();
  });

  it("still asks for what it does use", () => {
    expect(expo.ios.infoPlist.NSLocationWhenInUseUsageDescription).toBeTruthy();
    expect(expo.ios.infoPlist.NSCameraUsageDescription).toBeTruthy();
    expect(expo.ios.infoPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
  });
});

describe("app.config.js", () => {
  const plistWith = (body) => {
    const file = path.join(os.tmpdir(), `GoogleService-Info-${process.pid}.plist`);
    fs.writeFileSync(
      file,
      `<?xml version="1.0"?><plist><dict>${body}</dict></plist>`
    );
    return file;
  };

  it("reads the reversed client id out of the plist", () => {
    const file = plistWith(
      "<key>CLIENT_ID</key><string>1-abc.apps.googleusercontent.com</string>" +
        "<key>REVERSED_CLIENT_ID</key>\n  <string>com.googleusercontent.apps.1-abc</string>"
    );
    expect(reversedClientId(file)).toBe("com.googleusercontent.apps.1-abc");
    fs.unlinkSync(file);
  });

  it("is null when the plist has no such key, or no plist", () => {
    const file = plistWith("<key>API_KEY</key><string>x</string>");
    expect(reversedClientId(file)).toBeNull();
    fs.unlinkSync(file);
    expect(reversedClientId(path.join(os.tmpdir(), "does-not-exist.plist"))).toBeNull();
  });

  it("adds the Google Sign-In plugin only when it has a scheme to give it", () => {
    // The plugin throws at prebuild without `iosUrlScheme`, so an entry with
    // no scheme is worse than no entry.
    const base = { plugins: ["expo-font"] };
    expect(withGoogleSignIn(base, null)).toBe(base);

    const configured = withGoogleSignIn(base, "com.googleusercontent.apps.1-abc");
    expect(configured.plugins).toEqual([
      "expo-font",
      [
        "@react-native-google-signin/google-signin",
        { iosUrlScheme: "com.googleusercontent.apps.1-abc" },
      ],
    ]);
  });
});

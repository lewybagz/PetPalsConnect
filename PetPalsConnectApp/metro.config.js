const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * Modules with no web implementation, and the inert stand-ins used in their
 * place - **only** when bundling for the browser.
 *
 * The app ships on iOS and Android. It is rendered in a browser for one reason:
 * looking at it. There is no Android SDK, no KVM and no macOS on the machines
 * this repository is worked on from, so `expo export --platform web` plus a
 * headless Chromium is the only way the design system in `src/styles/tokens.ts`
 * gets reviewed by eye instead of only by contrast test.
 *
 * Scoped to `platform === "web"`, so an Android or iOS bundle resolves the real
 * packages and never sees any of this. `tools/web-stubs/README.md` has the
 * reasoning; `npm run gallery` is what uses it.
 */
const WEB_STUBS = {
  "@react-native-firebase/app": "tools/web-stubs/firebase-app.js",
  "@react-native-firebase/auth": "tools/web-stubs/firebase-auth.js",
  "@react-native-firebase/storage": "tools/web-stubs/firebase-storage.js",
  "@react-native-firebase/messaging": "tools/web-stubs/firebase-messaging.js",
  "@react-native-google-signin/google-signin": "tools/web-stubs/google-signin.js",
  "react-native-maps": "tools/web-stubs/maps.js",
  "@stripe/stripe-react-native": "tools/web-stubs/stripe.js",
  "@gorhom/bottom-sheet": "tools/web-stubs/bottom-sheet.js",
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stub = WEB_STUBS[moduleName];
  if (platform === "web" && stub) {
    return { type: "sourceFile", filePath: path.join(__dirname, stub) };
  }

  return (defaultResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  );
};

module.exports = config;

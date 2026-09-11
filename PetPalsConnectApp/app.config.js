const fs = require("fs");
const path = require("path");

/**
 * The part of the config that depends on a file that is not committed.
 *
 * Google Sign-In on iOS needs a URL scheme for the redirect back into the
 * app, and that scheme is the `REVERSED_CLIENT_ID` in GoogleService-Info.plist
 * - which is gitignored, and which only carries the key once the Google
 * provider is enabled in the Firebase console. So the plugin entry cannot
 * live in app.json: hardcoding the value commits a per-project identifier,
 * and the plugin throws at prebuild when the option is missing, which would
 * make a fresh clone unable to build at all.
 *
 * Everything static stays in app.json; this reads the plist and adds the one
 * entry it can support. Without the key it warns and leaves the plugin out -
 * Android sign-in works either way, and iOS says so at the console rather
 * than at the first tap of the button.
 */
const REVERSED_CLIENT_ID = /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/;

const reversedClientId = (plistPath) => {
  try {
    const match = fs.readFileSync(plistPath, "utf8").match(REVERSED_CLIENT_ID);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const withGoogleSignIn = (config, scheme) =>
  scheme
    ? {
        ...config,
        plugins: [
          ...(config.plugins ?? []),
          ["@react-native-google-signin/google-signin", { iosUrlScheme: scheme }],
        ],
      }
    : config;

module.exports = ({ config }) => {
  const plist = path.join(__dirname, config.ios?.googleServicesFile ?? "GoogleService-Info.plist");
  const scheme = reversedClientId(plist);
  if (!scheme) {
    console.warn(
      "[app.config] No REVERSED_CLIENT_ID in GoogleService-Info.plist - Google Sign-In " +
        "is off on iOS. Enable the Google provider in Firebase Authentication and " +
        "re-download the plist."
    );
  }
  return withGoogleSignIn(config, scheme);
};

module.exports.reversedClientId = reversedClientId;
module.exports.withGoogleSignIn = withGoogleSignIn;

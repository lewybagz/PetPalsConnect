import { registerRootComponent } from "expo";

import App from "./App";

/**
 * `EXPO_PUBLIC_GALLERY=1` swaps the app for the screenshot gallery.
 *
 * Set by `npm run gallery` and by nothing else, so a device build and both
 * store bundles always register the app. It is an `EXPO_PUBLIC_` variable
 * because Metro inlines those at build time - which is exactly what makes the
 * branch disappear from a normal bundle rather than shipping dead code.
 */
const Root = process.env.EXPO_PUBLIC_GALLERY === "1"
  ? require("./tools/gallery/Gallery").default
  : App;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and sets up the environment for both Expo Go and native builds.
registerRootComponent(Root);

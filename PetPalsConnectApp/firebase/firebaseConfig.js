import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getStorage } from "@react-native-firebase/storage";

/**
 * Firebase access for the app.
 *
 * Two Firebase libraries used to be installed side by side: the `firebase` web
 * JS SDK and `@react-native-firebase`. The app is standardised on React Native
 * Firebase, which is what push notifications require and which reads its config
 * from the native google-services.json / GoogleService-Info.plist rather than
 * from hardcoded keys in source.
 *
 * Firestore is deliberately absent. User, pet and chat data live in MongoDB
 * behind the API - keeping a second copy in Firestore was the reason the same
 * records were read inconsistently from two places.
 */
const app = getApp();
const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, storage };
export default app;

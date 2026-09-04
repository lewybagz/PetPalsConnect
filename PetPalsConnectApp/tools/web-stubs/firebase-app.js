/** `@react-native-firebase/app` has no web build. Inert stand-in. */
const app = () => ({ name: "[DEFAULT]", options: {} });
app.apps = [];
export default app;
export const getApp = app;
export const initializeApp = app;

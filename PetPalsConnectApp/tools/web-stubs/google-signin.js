/** `@react-native-google-signin/google-signin` has no web build. */
export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: async () => true,
  signIn: async () => {
    throw new Error("Google sign-in is not available on web");
  },
  signOut: async () => {},
};
export const statusCodes = {};
export const GoogleSigninButton = () => null;

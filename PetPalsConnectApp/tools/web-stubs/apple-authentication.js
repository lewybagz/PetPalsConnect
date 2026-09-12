/**
 * `@invertase/react-native-apple-authentication` has no web build - its
 * `AppleButton` is an `.ios.js` file only, so `expo export --platform web`
 * failed to resolve it and the gallery could not be built at all after Sign
 * in with Apple landed. Nothing here can sign anybody in: `isSupported` is
 * false, which is also what an Android phone reports, so the auth screens
 * take the same branch they take there.
 */
export const appleAuth = {
  isSupported: false,
  isSignUpButtonSupported: false,
  Operation: { IMPLICIT: 0, LOGIN: 1, REFRESH: 2, LOGOUT: 3 },
  Scope: { EMAIL: 0, FULL_NAME: 1 },
  State: { REVOKED: 0, AUTHORIZED: 1, NOT_FOUND: 2, TRANSFERRED: 3 },
  Error: { UNKNOWN: "1000", CANCELED: "1001", INVALID_RESPONSE: "1002", NOT_HANDLED: "1003", FAILED: "1004" },
  performRequest: async () => {
    throw new Error("Sign in with Apple is not available on web");
  },
  getCredentialStateForUser: async () => 2,
  onCredentialRevoked: () => () => {},
};

export const appleAuthAndroid = {
  isSupported: false,
  configure: () => {},
  signIn: async () => {
    throw new Error("Sign in with Apple is not available on web");
  },
  ResponseType: { ALL: 0, CODE: 1, ID_TOKEN: 2 },
  Scope: { ALL: 0, EMAIL: 1, NAME: 2 },
};

export const AppleButton = () => null;
AppleButton.Style = { WHITE: "White", WHITE_OUTLINE: "WhiteOutline", BLACK: "Black" };
AppleButton.Type = { SIGN_IN: "SignIn", CONTINUE: "Continue", SIGN_UP: "SignUp" };

export default appleAuth;

import { Platform } from "react-native";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import {
  getAuth,
  OAuthProvider,
  revokeToken,
  signInWithCredential,
} from "@react-native-firebase/auth";

/**
 * Sign in with Apple, in one place.
 *
 * Apple's 4.8 rule: an app offering any third-party login (this one offers
 * Google) has to offer Apple's as well, on iOS. Android is exempt, and the
 * library's Android side is a web flow this app has no service id for, so the
 * button only exists on iOS.
 *
 * Both auth screens already carry their own copy of the Google handler; this
 * is written once so there is no third copy to drift. The nonce is generated
 * by the library and handed back with the response, so Firebase can verify the
 * identity token was minted for this request and not replayed.
 */
export const appleSignInAvailable = () =>
  Platform.OS === "ios" && appleAuth.isSupported;

/** The library rejects a dismissed sheet with this code, like Google's `SIGN_IN_CANCELLED`. */
export const isAppleCancel = (error) => error?.code === appleAuth.Error.CANCELED;

export const signInWithApple = async () => {
  const { identityToken, nonce } = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    // Name first: the library's FAQ notes Apple returns nothing for the name
    // when EMAIL is listed before FULL_NAME.
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });

  if (!identityToken) {
    throw new Error("Apple sign-in returned no credential.");
  }

  const credential = new OAuthProvider("apple.com").credential({
    idToken: identityToken,
    rawNonce: nonce,
  });
  return signInWithCredential(getAuth(), credential);
};

export const isAppleAccount = (user) =>
  (user?.providerData ?? []).some((p) => p.providerId === "apple.com");

/**
 * Revokes this app's Sign in with Apple grant.
 *
 * Apple requires it when an account that used Sign in with Apple is deleted
 * (guideline 5.1.1(v)); deleting the Firebase user alone leaves the app listed
 * under the person's Apple ID as still connected. Revocation needs a fresh
 * authorization code, so Apple prompts once more. A dismissed prompt rejects,
 * and the caller must not go on to delete the account without it.
 */
export const revokeAppleAccess = async () => {
  const { authorizationCode } = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.REFRESH,
  });

  if (!authorizationCode) {
    throw new Error("Apple returned no authorization code.");
  }

  await revokeToken(getAuth(), authorizationCode);
};

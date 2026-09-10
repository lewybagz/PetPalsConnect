import { Platform } from "react-native";
import { appleAuth } from "@invertase/react-native-apple-authentication";
import {
  OAuthProvider,
  revokeToken,
  signInWithCredential,
} from "@react-native-firebase/auth";

import {
  appleSignInAvailable,
  isAppleAccount,
  isAppleCancel,
  revokeAppleAccess,
  signInWithApple,
} from "./appleAuth";

/**
 * The credential has to be built from Apple's identity token *and* the nonce
 * the library generated for that request - Firebase rejects the token without
 * it - and a response with no token must stop before Firebase is asked
 * anything. Revocation is the other half of the Apple rule: deleting an
 * account is not allowed to skip it, so a missing code has to throw.
 */
describe("signInWithApple", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs Firebase in with the identity token and the request nonce", async () => {
    appleAuth.performRequest.mockResolvedValueOnce({
      identityToken: "id-token",
      nonce: "raw-nonce",
    });

    await signInWithApple();

    expect(OAuthProvider.__credential).toHaveBeenCalledWith({
      idToken: "id-token",
      rawNonce: "raw-nonce",
    });
    expect(signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it("throws before touching Firebase when Apple returns no token", async () => {
    appleAuth.performRequest.mockResolvedValueOnce({ identityToken: null, nonce: "n" });

    await expect(signInWithApple()).rejects.toThrow(/no credential/);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it("asks for the name before the email", async () => {
    appleAuth.performRequest.mockResolvedValueOnce({ identityToken: "t", nonce: "n" });

    await signInWithApple();

    const [options] = appleAuth.performRequest.mock.calls[0];
    expect(options.requestedScopes).toEqual([
      appleAuth.Scope.FULL_NAME,
      appleAuth.Scope.EMAIL,
    ]);
  });
});

describe("revokeAppleAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revokes with the authorization code from a refresh request", async () => {
    appleAuth.performRequest.mockResolvedValueOnce({ authorizationCode: "code-1" });

    await revokeAppleAccess();

    expect(appleAuth.performRequest).toHaveBeenCalledWith({
      requestedOperation: appleAuth.Operation.REFRESH,
    });
    expect(revokeToken).toHaveBeenCalledWith(expect.anything(), "code-1");
  });

  it("throws rather than silently skipping when no code comes back", async () => {
    appleAuth.performRequest.mockResolvedValueOnce({ authorizationCode: null });

    await expect(revokeAppleAccess()).rejects.toThrow(/authorization code/);
    expect(revokeToken).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("recognises an Apple-linked account by provider id", () => {
    expect(isAppleAccount({ providerData: [{ providerId: "apple.com" }] })).toBe(true);
    expect(isAppleAccount({ providerData: [{ providerId: "google.com" }] })).toBe(false);
    expect(isAppleAccount(null)).toBe(false);
  });

  it("treats the library's cancel code as a cancel and nothing else", () => {
    expect(isAppleCancel({ code: appleAuth.Error.CANCELED })).toBe(true);
    expect(isAppleCancel({ code: "1000" })).toBe(false);
    expect(isAppleCancel(undefined)).toBe(false);
  });

  it("is only available on iOS", () => {
    const original = Platform.OS;
    Platform.OS = "android";
    expect(appleSignInAvailable()).toBe(false);
    Platform.OS = "ios";
    expect(appleSignInAvailable()).toBe(true);
    Platform.OS = original;
  });
});

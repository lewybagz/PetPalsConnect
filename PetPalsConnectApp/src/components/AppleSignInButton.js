import React from "react";
import { AppleButton } from "@invertase/react-native-apple-authentication";

import {
  appleSignInAvailable,
  isAppleCancel,
  signInWithApple,
} from "../api/appleAuth";
import { useAppTheme } from "../context/AppThemeContext";
import { describeAuthError } from "../utils/authErrors";
import { useTailwind } from "../styles/tailwind";

/**
 * Apple's own button, wired to the one Apple sign-in path.
 *
 * Apple's HIG requires its control (their artwork, their corner radius, their
 * wording) and at least the prominence of any other provider's, so this is
 * the library's `AppleButton` rather than a `Pressable` styled to match the
 * Google one. Renders nothing off iOS: Android is exempt from the rule and has
 * no service id configured.
 *
 * Signing in changes Firebase auth state and `RootNavigator` swaps the tree,
 * so like the other auth buttons this never navigates.
 */
const AppleSignInButton = ({ disabled = false, onError }) => {
  const { isDark } = useAppTheme();
  const tailwind = useTailwind();

  if (!appleSignInAvailable()) return null;

  const onPress = async () => {
    try {
      await signInWithApple();
    } catch (error) {
      if (!isAppleCancel(error)) onError?.(describeAuthError(error));
    }
  };

  return (
    <AppleButton
      testID="apple-sign-in"
      buttonStyle={isDark ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
      buttonType={AppleButton.Type.CONTINUE}
      cornerRadius={8}
      style={[tailwind("w-full mb-3"), { height: 52, opacity: disabled ? 0.5 : 1 }]}
      onPress={disabled ? undefined : onPress}
    />
  );
};

export default AppleSignInButton;

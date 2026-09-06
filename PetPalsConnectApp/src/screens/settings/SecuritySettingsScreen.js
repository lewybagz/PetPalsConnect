import React, { useCallback, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from "@react-native-firebase/auth";

import {
  Button,
  Screen,
  SettingsRow,
  SettingsSection,
  Text,
  useToast,
} from "../../components/ui";
import { useTokens } from "../../context/AppThemeContext";
import { useTailwind } from "../../styles/tailwind";
import { describeAuthError } from "../../utils/authErrors";
import { scorePassword } from "../../utils/passwordStrength";

/**
 * Signing in, and what protects it.
 *
 * The old screen could not run at all: it imported `Picker` from `react-native`
 * - removed from core in 0.62, twenty-four releases before the version this app
 * uses - so it rendered `undefined` as a component. Below that it posted to
 * `/api/users/settings/change-password`, which answers 410 by design because
 * Firebase Auth owns credentials and this server has never had a password
 * field; a `token` parameter that was never passed went into the header of
 * every one of its three requests; and `getToken()` was called without being
 * awaited, three times, for a value nothing used.
 *
 * Two of its three settings are gone rather than repaired. A two-factor switch
 * wrote a `twoFactorAuthEnabled` flag that nothing reads and no sign-in
 * consults, and eleven security questions were hashed into a field with no
 * recovery flow to check them - both stored, neither honoured, which is the
 * failure this whole pass exists to stop. A padlock that is not connected to
 * anything is worse than no padlock, because somebody relies on it.
 *
 * What is left is real: the password change goes through Firebase, which is
 * where the password lives.
 */

/** Firebase requires a recent sign-in before it will change a password. */
const REAUTH_CODES = ["auth/requires-recent-login", "auth/user-token-expired"];

/**
 * `user` is only ever passed by the screenshot gallery.
 *
 * The web stub for `@react-native-firebase/auth` keeps `currentUser` null on
 * purpose - a stub that returned a user would make every screen claim a session
 * that does not exist, and `tooling.test.js` enforces it. Without a seam, the
 * one board for this screen could only ever show the "no password" branch, and
 * the form would be the part of it nobody ever looked at.
 */
const SecuritySettingsScreen = ({ user: providedUser }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();
  const auth = getAuth();
  const user = providedUser ?? auth.currentUser;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * How this account signs in.
   *
   * Somebody who signed up with Google has no password to change, and offering
   * them a form that can only fail is worse than saying so.
   */
  const providers = useMemo(
    () => (user?.providerData ?? []).map((entry) => entry.providerId),
    [user]
  );
  const hasPassword = providers.includes("password");

  const PROVIDER_LABELS = {
    password: "Email and password",
    "google.com": "Google",
    phone: "Phone number",
  };

  const strength = scorePassword(newPassword);

  const handleChangePassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      toast.show("Those two passwords don't match.");
      return;
    }
    if (!strength.isAcceptable) {
      toast.show(strength.label);
      return;
    }

    setBusy(true);
    try {
      // Reauthenticate first rather than waiting for Firebase to demand it.
      // `updatePassword` refuses on a session older than a few minutes, and the
      // old screen collected a current password and then never used it - so the
      // form asked for something it threw away and failed anyway.
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (error) {
      toast.error(
        REAUTH_CODES.includes(error.code)
          ? "Please sign in again, then change your password."
          : describeAuthError(error)
      );
    } finally {
      setBusy(false);
    }
  }, [user, currentPassword, newPassword, confirmPassword, strength, toast]);

  const handleReset = useCallback(async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success(`Sent a reset link to ${user.email}.`);
    } catch (error) {
      toast.error(describeAuthError(error));
    }
  }, [auth, user, toast]);

  const field = (props) => (
    <TextInput
      style={[
        tailwind(
          "border border-borderStrong rounded-control px-md py-md mb-md bg-surface text-text"
        ),
        { minHeight: 44 },
      ]}
      placeholderTextColor={tokens.textFaint}
      secureTextEntry
      autoCapitalize="none"
      autoComplete="off"
      editable={!busy}
      {...props}
    />
  );

  return (
    <Screen testID="security-settings" scroll>
      <Text variant="display" style={tailwind("mb-lg")}>
        Sign-in and security
      </Text>

      <SettingsSection
        title="This account"
        footer="Signing out everywhere happens automatically when your password changes - every other device is asked to sign in again."
      >
        <SettingsRow label="Email" detail={user?.email ?? "Not set"} />
        <SettingsRow
          label="Sign-in method"
          detail={providers.map((id) => PROVIDER_LABELS[id] ?? id).join(", ") || "Unknown"}
        />
      </SettingsSection>

      {hasPassword ? (
        <SettingsSection title="Change your password">
          <View style={tailwind("p-lg")}>
            {field({
              testID: "security-current-password",
              placeholder: "Current password",
              value: currentPassword,
              onChangeText: setCurrentPassword,
              textContentType: "password",
            })}
            {field({
              testID: "security-new-password",
              placeholder: "New password",
              value: newPassword,
              onChangeText: setNewPassword,
              textContentType: "newPassword",
            })}
            {field({
              testID: "security-confirm-password",
              placeholder: "Confirm new password",
              value: confirmPassword,
              onChangeText: setConfirmPassword,
              textContentType: "newPassword",
            })}

            {newPassword ? (
              <Text
                testID="security-password-strength"
                variant="caption"
                tone={strength.isAcceptable ? "success" : "muted"}
                style={tailwind("mb-md")}
              >
                {strength.label}
              </Text>
            ) : null}

            <Button
              testID="security-change-password"
              title="Change password"
              loading={busy}
              disabled={busy || !currentPassword || !newPassword}
              onPress={handleChangePassword}
            />
          </View>
        </SettingsSection>
      ) : (
        <SettingsSection title="Password">
          <SettingsRow
            label="No password on this account"
            description="You sign in with a provider that manages its own credentials, so there is nothing here to change."
          />
        </SettingsSection>
      )}

      {user?.email ? (
        <SettingsSection title="Forgotten it">
          <SettingsRow
            testID="security-reset-password"
            label="Email me a reset link"
            description="Useful when you cannot remember the current one."
            onPress={handleReset}
          />
        </SettingsSection>
      ) : null}

      <View style={tailwind("mb-xl")} />
    </Screen>
  );
};

export default SecuritySettingsScreen;

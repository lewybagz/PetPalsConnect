import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { OnboardingProgress } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import useUsernameAvailability from "../../hooks/useUsernameAvailability";
import { describeApiError } from "../../utils/authErrors";
import { useTokens } from "../../context/AppThemeContext";

/**
 * Finishes signup by creating the Mongo profile for the current Firebase
 * account.
 *
 * RootNavigator shows this whenever someone is authenticated but has no
 * profile, so it covers three cases with one screen: a fresh email signup, a
 * first-time Google sign-in, and resuming a signup that was interrupted before
 * the profile was created.
 */
export default function CreateProfileScreen() {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const { firebaseUser, createProfile, signOut } = useAuthSession();

  // Google gives us a display name; use it as a starting point.
  const suggested = useMemo(() => {
    const source = firebaseUser?.displayName ?? firebaseUser?.email?.split("@")[0] ?? "";
    return source.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  }, [firebaseUser]);

  const [username, setUsername] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const availability = useUsernameAvailability(username);

  const canSubmit =
    !submitting &&
    username.trim().length >= 3 &&
    availability.status !== "unavailable" &&
    availability.status !== "checking";

  const onSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createProfile({ username: username.trim() });
      // No navigation call: creating the profile flips the session to "ready"
      // and RootNavigator swaps in the app tree.
    } catch (error) {
      setSubmitError(describeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    Alert.alert(
      "Leave setup?",
      "Your account stays and you can finish this next time you open the app.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: signOut },
      ]
    );
  };

  const hint = {
    idle: "3-20 characters. Letters, numbers and underscores.",
    checking: "Checking availability...",
    available: `${username.trim()} is available.`,
    unavailable: availability.reason,
    unknown: "We'll confirm this when you continue.",
  }[availability.status];

  const hintColour = {
    idle: "text-textMuted",
    checking: "text-textMuted",
    available: "text-success",
    unavailable: "text-danger",
    unknown: "text-textMuted",
  }[availability.status];

  return (
    <KeyboardAvoidingView
      style={tailwind("flex-1 bg-surface")}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={tailwind("flex-grow justify-center px-8 py-12")}
        keyboardShouldPersistTaps="handled"
      >
        {/* Signing up is three writes that cannot be made atomic, and none of
            the screens said so. Being interrupted after this one left no way to
            tell whether you had finished. */}
        <OnboardingProgress step={2} />

        <View style={tailwind("items-center mb-8")}>
          <Ionicons name="paw" size={48} color={tokens.primary} />
          <Text style={tailwind("text-2xl font-bold text-text mt-4")}>
            Pick your username
          </Text>
          <Text style={tailwind("text-center text-textMuted mt-2")}>
            This is how other pet owners will find you.
          </Text>
        </View>

        <View style={tailwind("mb-2")}>
          <View
            style={tailwind(
              `flex-row items-center border rounded-lg px-3 ${
                availability.status === "unavailable"
                  ? "border-danger"
                  : availability.status === "available"
                    ? "border-success"
                    : "border-border"
              }`
            )}
          >
            <Text style={tailwind("text-textFaint text-base")}>@</Text>
            <TextInput
              style={tailwind("flex-1 py-3 px-1 text-base text-text")}
              placeholder="username"
              placeholderTextColor={tokens.textFaint}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={canSubmit ? onSubmit : undefined}
              editable={!submitting}
            />
            {availability.status === "checking" && <ActivityIndicator size="small" />}
            {availability.status === "available" && (
              <Ionicons name="checkmark-circle" size={22} color={tokens.success} />
            )}
            {availability.status === "unavailable" && (
              <Ionicons name="close-circle" size={22} color={tokens.danger} />
            )}
          </View>
        </View>

        <Text style={tailwind(`text-sm mb-6 ${hintColour}`)}>{hint}</Text>

        {submitError && (
          <Text style={tailwind("text-danger text-center mb-4")}>{submitError}</Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={tailwind(
            `rounded-lg py-4 items-center ${canSubmit ? "bg-danger" : "bg-border"}`
          )}
        >
          {submitting ? (
            <ActivityIndicator color={tokens.surface} />
          ) : (
            <Text style={tailwind("text-onPrimary font-semibold text-base")}>Continue</Text>
          )}
        </Pressable>

        <Pressable onPress={onCancel} style={tailwind("mt-6 items-center")}>
          <Text style={tailwind("text-textMuted")}>Not now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

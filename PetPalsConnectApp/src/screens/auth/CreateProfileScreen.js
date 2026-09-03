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
import { useAuthSession } from "../../context/AuthSessionContext";
import useUsernameAvailability from "../../hooks/useUsernameAvailability";
import { describeApiError } from "../../utils/authErrors";

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
    idle: "text-gray-500",
    checking: "text-gray-500",
    available: "text-green-600",
    unavailable: "text-red-500",
    unknown: "text-gray-500",
  }[availability.status];

  return (
    <KeyboardAvoidingView
      style={tailwind("flex-1 bg-white")}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={tailwind("flex-grow justify-center px-8 py-12")}
        keyboardShouldPersistTaps="handled"
      >
        <View style={tailwind("items-center mb-8")}>
          <Ionicons name="paw" size={48} color="tomato" />
          <Text style={tailwind("text-2xl font-bold text-gray-900 mt-4")}>
            Pick your username
          </Text>
          <Text style={tailwind("text-center text-gray-600 mt-2")}>
            This is how other pet owners will find you.
          </Text>
        </View>

        <View style={tailwind("mb-2")}>
          <View
            style={tailwind(
              `flex-row items-center border rounded-lg px-3 ${
                availability.status === "unavailable"
                  ? "border-red-400"
                  : availability.status === "available"
                    ? "border-green-500"
                    : "border-gray-300"
              }`
            )}
          >
            <Text style={tailwind("text-gray-400 text-base")}>@</Text>
            <TextInput
              style={tailwind("flex-1 py-3 px-1 text-base text-gray-900")}
              placeholder="username"
              placeholderTextColor="#a1a1a1"
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
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
            )}
            {availability.status === "unavailable" && (
              <Ionicons name="close-circle" size={22} color="#ef4444" />
            )}
          </View>
        </View>

        <Text style={tailwind(`text-sm mb-6 ${hintColour}`)}>{hint}</Text>

        {submitError && (
          <Text style={tailwind("text-red-500 text-center mb-4")}>{submitError}</Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={tailwind(
            `rounded-lg py-4 items-center ${canSubmit ? "bg-red-500" : "bg-gray-300"}`
          )}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={tailwind("text-white font-semibold text-base")}>Continue</Text>
          )}
        </Pressable>

        <Pressable onPress={onCancel} style={tailwind("mt-6 items-center")}>
          <Text style={tailwind("text-gray-500")}>Not now</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

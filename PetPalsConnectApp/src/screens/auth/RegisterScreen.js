import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { isEmail } from "validator";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { useTailwind } from "../../styles/tailwind";
import { OnboardingProgress } from "../../components/ui";
import { GOOGLE_WEB_CLIENT_ID } from "../../config/env";
import { describeAuthError } from "../../utils/authErrors";
import { passwordRules, scorePassword } from "../../utils/passwordStrength";

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

const STRENGTH_COLOURS = ["bg-gray-300", "bg-red-400", "bg-yellow-400", "bg-green-500"];

/**
 * Creates the Firebase account.
 *
 * It deliberately stops there. The Mongo profile is created by
 * CreateProfileScreen, which RootNavigator shows as soon as the session reports
 * an authenticated user without one. Doing it here instead would mean an
 * interruption between the two calls stranded the user in an app with no
 * profile and no way back.
 *
 * There is also no navigation call on success: creating the account changes
 * Firebase auth state, and the navigator swaps trees on its own. The previous
 * version navigated to "Login", a route that no longer exists by that point.
 */
export default function RegisterScreen({ navigation }) {
  const tailwind = useTailwind();
  const auth = getAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = scorePassword(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const canSubmit =
    !submitting && isEmail(email.trim()) && strength.isAcceptable && passwordsMatch;

  const onRegisterPress = async () => {
    setErrorMessage(null);

    if (!isEmail(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!strength.isAcceptable) {
      setErrorMessage("Please choose a stronger password.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Best-effort: a failed verification email must not fail the signup, or
      // the user ends up with an account they think was never created.
      sendEmailVerification(credential.user).catch((error) =>
        console.warn("[auth] Could not send verification email:", error.message)
      );
    } catch (error) {
      setErrorMessage(describeAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleButtonPress = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken ?? response?.idToken;
      if (!idToken) throw new Error("Google sign-in returned no credential.");

      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      // As above: no navigation. A first-time Google user has no profile yet,
      // so the navigator routes them to CreateProfile automatically.
    } catch (error) {
      if (error?.code !== "SIGN_IN_CANCELLED") {
        setErrorMessage(describeAuthError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={tailwind("flex-1 bg-white")}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={tailwind("flex-grow justify-center px-8 py-12")}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingProgress step={1} />

        <View style={tailwind("items-center mb-8")}>
          <Ionicons name="paw" size={48} color="tomato" />
          <Text style={tailwind("text-2xl font-bold text-gray-900 mt-4")}>
            Create your account
          </Text>
        </View>

        {errorMessage && (
          <View style={tailwind("bg-red-50 border border-red-200 rounded-lg p-3 mb-4")}>
            <Text style={tailwind("text-red-600 text-center")}>{errorMessage}</Text>
          </View>
        )}

        <TextInput
          style={tailwind("border border-gray-300 rounded-lg px-3 py-3 mb-4 text-base")}
          placeholder="Email"
          placeholderTextColor="#a1a1a1"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          // "sentences" here capitalised the first letter of every email and
          // password, which is a small but constant annoyance.
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={!submitting}
        />

        <View
          style={tailwind("flex-row items-center border border-gray-300 rounded-lg px-3 mb-2")}
        >
          <TextInput
            style={tailwind("flex-1 py-3 text-base")}
            placeholder="Password"
            placeholderTextColor="#a1a1a1"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!submitting}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={22}
              color="#888"
            />
          </Pressable>
        </View>

        {password.length > 0 && (
          <View style={tailwind("mb-4")}>
            <View style={tailwind("flex-row items-center mb-2")}>
              <View style={tailwind("flex-1 flex-row")}>
                {[0, 1, 2].map((index) => (
                  <View
                    key={index}
                    style={tailwind(
                      `h-1 flex-1 mr-1 rounded ${
                        index < strength.score ? STRENGTH_COLOURS[strength.score] : "bg-gray-200"
                      }`
                    )}
                  />
                ))}
              </View>
              <Text style={tailwind("text-xs text-gray-500 ml-2")}>{strength.label}</Text>
            </View>

            {passwordRules.map((rule) => {
              const met = strength.met.has(rule.id);
              return (
                <View key={rule.id} style={tailwind("flex-row items-center mb-1")}>
                  <Ionicons
                    name={met ? "checkmark-circle" : "ellipse-outline"}
                    size={15}
                    color={met ? "#16a34a" : "#c0c0c0"}
                  />
                  <Text
                    style={tailwind(
                      `text-xs ml-2 ${met ? "text-green-600" : "text-gray-500"}`
                    )}
                  >
                    {rule.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <TextInput
          style={tailwind(
            `border rounded-lg px-3 py-3 mb-6 text-base ${
              confirmPassword.length > 0 && !passwordsMatch
                ? "border-red-400"
                : "border-gray-300"
            }`
          )}
          placeholder="Confirm password"
          placeholderTextColor="#a1a1a1"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          editable={!submitting}
        />

        <Pressable
          onPress={onRegisterPress}
          disabled={!canSubmit}
          style={tailwind(
            `rounded-lg py-4 items-center ${canSubmit ? "bg-red-500" : "bg-gray-300"}`
          )}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={tailwind("text-white font-semibold text-base")}>
              Create account
            </Text>
          )}
        </Pressable>

        <View style={tailwind("flex-row items-center my-6")}>
          <View style={tailwind("flex-1 h-px bg-gray-200")} />
          <Text style={tailwind("mx-3 text-gray-400 text-sm")}>or</Text>
          <View style={tailwind("flex-1 h-px bg-gray-200")} />
        </View>

        <Pressable
          onPress={onGoogleButtonPress}
          disabled={submitting}
          style={tailwind(
            "flex-row items-center justify-center border border-gray-300 rounded-lg py-4"
          )}
        >
          <Ionicons name="logo-google" size={20} color="#444" />
          <Text style={tailwind("text-gray-800 font-semibold ml-3")}>
            Continue with Google
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={tailwind("mt-8 items-center")}
        >
          <Text style={tailwind("text-gray-600")}>
            Already have an account? <Text style={tailwind("text-red-500")}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

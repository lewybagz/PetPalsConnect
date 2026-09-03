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
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { isEmail } from "validator";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { useTailwind } from "../../styles/tailwind";
import { GOOGLE_WEB_CLIENT_ID } from "../../config/env";
import { describeAuthError } from "../../utils/authErrors";

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/**
 * Signs the user in. Nothing else.
 *
 * The previous version read the user document out of Firestore, wrote a token
 * into SecureStore by hand, dispatched it into Redux and then navigated to
 * "Home". All four are now handled elsewhere: Firestore is gone, the API client
 * takes tokens straight from the Firebase SDK, AuthSessionContext owns the
 * profile, and RootNavigator swaps trees on auth state. It also rendered
 * `styles.modalView` from a `styles` import that react-native does not export,
 * so the 2FA modal threw as soon as it opened.
 */
export default function LoginScreen({ navigation }) {
  const tailwind = useTailwind();
  const auth = getAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !submitting && email.trim().length > 0 && password.length > 0;

  const onLoginPress = async () => {
    setErrorMessage(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // No navigation: the session flips to "ready" (or "needsProfile" if this
      // account never finished signing up) and the navigator follows.
    } catch (error) {
      setErrorMessage(describeAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onGooglePress = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken ?? response?.idToken;
      if (!idToken) throw new Error("Google sign-in returned no credential.");

      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } catch (error) {
      if (error?.code !== "SIGN_IN_CANCELLED") {
        setErrorMessage(describeAuthError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    setErrorMessage(null);
    setNotice(null);

    if (!isEmail(email.trim())) {
      setErrorMessage("Enter your email address first, then tap Forgot password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Deliberately the same message whether or not the account exists, so
      // this cannot be used to discover which emails are registered.
      setNotice("If there's an account for that email, a reset link is on its way.");
    } catch (error) {
      setErrorMessage(describeAuthError(error));
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
        <View style={tailwind("items-center mb-8")}>
          <Ionicons name="paw" size={48} color="tomato" />
          <Text style={tailwind("text-2xl font-bold text-gray-900 mt-4")}>
            Welcome back
          </Text>
        </View>

        {errorMessage && (
          <View style={tailwind("bg-red-50 border border-red-200 rounded-lg p-3 mb-4")}>
            <Text style={tailwind("text-red-600 text-center")}>{errorMessage}</Text>
          </View>
        )}

        {notice && (
          <View style={tailwind("bg-green-50 border border-green-200 rounded-lg p-3 mb-4")}>
            <Text style={tailwind("text-green-700 text-center")}>{notice}</Text>
          </View>
        )}

        <TextInput
          style={tailwind("border border-gray-300 rounded-lg px-3 py-3 mb-4 text-base")}
          placeholder="Email"
          placeholderTextColor="#a1a1a1"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
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
            autoComplete="current-password"
            textContentType="password"
            editable={!submitting}
            returnKeyType="go"
            onSubmitEditing={canSubmit ? onLoginPress : undefined}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={22}
              color="#888"
            />
          </Pressable>
        </View>

        <Pressable onPress={onForgotPassword} style={tailwind("self-end mb-6")}>
          <Text style={tailwind("text-sm text-gray-500")}>Forgot password?</Text>
        </Pressable>

        <Pressable
          onPress={onLoginPress}
          disabled={!canSubmit}
          style={tailwind(
            `rounded-lg py-4 items-center ${canSubmit ? "bg-red-500" : "bg-gray-300"}`
          )}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={tailwind("text-white font-semibold text-base")}>Sign in</Text>
          )}
        </Pressable>

        <View style={tailwind("flex-row items-center my-6")}>
          <View style={tailwind("flex-1 h-px bg-gray-200")} />
          <Text style={tailwind("mx-3 text-gray-400 text-sm")}>or</Text>
          <View style={tailwind("flex-1 h-px bg-gray-200")} />
        </View>

        <Pressable
          onPress={onGooglePress}
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
          onPress={() => navigation.navigate("PhoneAuth")}
          style={tailwind("flex-row items-center justify-center border border-gray-300 rounded-lg py-4 mt-3")}
        >
          <Ionicons name="call-outline" size={20} color="#444" />
          <Text style={tailwind("text-gray-800 font-semibold ml-3")}>
            Continue with phone
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Register")}
          style={tailwind("mt-8 items-center")}
        >
          <Text style={tailwind("text-gray-600")}>
            New here? <Text style={tailwind("text-red-500")}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

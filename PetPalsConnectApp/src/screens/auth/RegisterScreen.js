// RegisterScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet } from "react-native";

import {
  getAuth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  FacebookAuthProvider,
} from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { LoginManager, AccessToken } from "react-native-fbsdk-next";
import AnimatedButton from "../../components/AnimatedButton";
import { useTailwind } from "nativewind";

// Configure Google Sign-in (you should have this configuration outside of your component)
GoogleSignin.configure({
  webClientId: "your-web-client-id.apps.googleusercontent.com",
});

function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(null); // Define errorMessage as state
  const tailwind = useTailwind();

  const auth = getAuth();

  const onRegisterPress = () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match.");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        // Send email verification
        user.sendEmailVerification().then(() => {
          Alert.alert(
            "Verify your email",
            "A verification email has been sent to your email address."
          );
          navigation.navigate("Login");
        });
      })
      .catch((error) => {
        setErrorMessage(error.message); // Set errorMessage when there is an error
      });
  };

  const onGoogleButtonPress = async () => {
    try {
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
      navigation.navigate("Home"); // Assuming 'Home' is the name of your home screen in the navigator
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const onFacebookButtonPress = async () => {
    try {
      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);
      if (result.isCancelled) {
        throw "User cancelled the login process";
      }
      const data = await AccessToken.getCurrentAccessToken();
      if (!data) {
        throw "Something went wrong obtaining access token";
      }
      const facebookCredential = FacebookAuthProvider.credential(
        data.accessToken
      );
      await signInWithCredential(auth, facebookCredential);
      navigation.navigate("Home"); // Assuming 'Home' is the name of your home screen in the navigator
    } catch (error) {
      Alert.alert("Error", error);
    }
  };

  return (
    <View style={tailwind("flex-1 justify-center items-center bg-gray-100")}>
      <View style={tailwind("w-full px-10")}>
        <Text style={[styles.heading, tailwind("text-center text-gray-800")]}>
          Register
        </Text>

        {errorMessage && (
          <Text style={tailwind("text-center text-red-500 mb-4")}>
            {errorMessage}
          </Text>
        )}

        <View style={tailwind("mb-4")}>
          <TextInput
            style={[styles.input, tailwind("border-gray-300")]}
            placeholder="Email"
            placeholderTextColor="#a1a1a1"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
          />
        </View>

        <View style={tailwind("mb-4")}>
          <TextInput
            style={[styles.input, tailwind("border-gray-300")]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            placeholderTextColor="#a1a1a1"
          />
        </View>

        <View style={tailwind("mb-6")}>
          <TextInput
            style={[styles.input, tailwind("border-gray-300")]}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            placeholderTextColor="#a1a1a1"
          />
        </View>

        <AnimatedButton
          text="Register"
          onPress={onRegisterPress}
          buttonStyle={tailwind("bg-blue-500 rounded-md")}
          textStyle={tailwind("text-white font-semibold")}
        />
      </View>
      <AnimatedButton
        text="Sign In with Google"
        onPress={() =>
          onGoogleButtonPress().then(() => navigation.navigate("Home"))
        }
        buttonStyle={[tailwind("bg-red-500 rounded-md"), { marginTop: 16 }]}
        textStyle={tailwind("text-white font-semibold")}
      />

      <AnimatedButton
        text="Sign In with Facebook"
        onPress={() =>
          onFacebookButtonPress().then(() => navigation.navigate("Home"))
        }
        buttonStyle={[tailwind("bg-blue-500 rounded-md"), { marginTop: 16 }]}
        textStyle={tailwind("text-white font-semibold")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 12,
  },
});

export default RegisterScreen;

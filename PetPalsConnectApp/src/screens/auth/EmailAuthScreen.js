import React, { useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import { useTailwind } from "nativewind";
import {
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
} from "firebase/auth";

const EmailVerificationScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const { email } = route.params;
  const [isChecking, setIsChecking] = useState(false);
  const auth = getAuth();

  const checkVerification = () => {
    setIsChecking(true);
    onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        // Email is verified, navigate to next screen or dashboard
        setIsChecking(false);
        navigation.navigate("Login"); // Replace with your next screen
      } else {
        setIsChecking(false);
        Alert.alert("Verification Pending", "Please verify your email first.");
      }
    });
  };

  const resendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      Alert.alert(
        "Verification Email Sent",
        "Please check your email for the verification link."
      );
    }
  };

  return (
    <View style={tailwind("flex-1 justify-center items-center")}>
      <Text style={tailwind("text-lg mb-4")}>Email Sent</Text>
      <Text style={tailwind("text-center mb-4")}>
        We&rsquo;ve sent a verification link to {email}. Please check your email
        and click on the link to verify your account.
      </Text>
      <Button
        title="I've Verified My Email"
        onPress={checkVerification}
        disabled={isChecking}
      />
      <Button
        title="Resend Verification Email"
        onPress={resendVerificationEmail}
      />
    </View>
  );
};

export default EmailVerificationScreen;

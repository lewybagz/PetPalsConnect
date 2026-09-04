import React, { useState } from "react";
import { View, Text, Button } from "react-native";
import { useTailwind } from "../../styles/tailwind";
import {
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
} from "@react-native-firebase/auth";
import { useToast } from "../../components/ui";

const EmailVerificationScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const toast = useToast();
  // route.params is undefined when this screen is opened directly (deep link,
  // or restored navigation state), which used to throw on destructuring.
  const email = route.params?.email ?? getAuth().currentUser?.email ?? "";
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
        toast.show("Verify your email first - check your inbox.");
      }
    });
  };

  const resendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      toast.success("Verification email sent - check your inbox.");
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

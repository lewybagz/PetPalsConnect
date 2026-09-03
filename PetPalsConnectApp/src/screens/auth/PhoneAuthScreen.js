import React, { useState } from "react";
import { View, Button, TextInput, Alert } from "react-native";
import { getAuth, PhoneAuthProvider } from "@react-native-firebase/auth";

const PhoneAuth = (navigation) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const auth = getAuth();

  const sendVerification = async () => {
    try {
      // React Native Firebase verifies phone numbers natively (SafetyNet /
      // Play Integrity on Android, silent APNs push on iOS). The old
      // expo-firebase-recaptcha modal was for the web SDK and has been removed
      // from Expo, so no verifier needs to be passed here.
      const confirmation = await auth.verifyPhoneNumber(phoneNumber);
      setVerificationId(confirmation.verificationId);
      Alert.alert("Verification code has been sent to your phone.");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const confirmCode = async () => {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await auth.signInWithCredential(credential);
      Alert.alert(
        "Phone authentication successful",
        "You will be redirected to the login screen.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }]
      );
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <View>
      <TextInput
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        placeholder={"Phone number ... "}
        keyboardType="phone-pad"
        autoCompleteType="tel"
      />
      <Button title="Send Verification" onPress={sendVerification} />
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={"Confirmation Code ... "}
      />
      <Button title="Confirm Code" onPress={confirmCode} />
    </View>
  );
};

export default PhoneAuth;

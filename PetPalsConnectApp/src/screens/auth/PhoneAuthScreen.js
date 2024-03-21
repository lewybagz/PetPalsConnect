import React, { useState, useRef } from "react";
import { View, Button, TextInput, Alert } from "react-native";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { getAuth, PhoneAuthProvider } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native"; // Ensure you have installed React Navigation

const PhoneAuth = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const recaptchaVerifier = useRef(null);
  const auth = getAuth();
  const navigation = useNavigation(); // Use the useNavigation hook

  const sendVerification = async () => {
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        phoneNumber,
        recaptchaVerifier.current
      );
      setVerificationId(id);
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
        [
          { text: "OK", onPress: () => navigation.navigate("Login") }, // Navigate to the LoginScreen
        ]
      );
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <View>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={auth.app.options}
        attemptInvisibleVerification={true}
      />
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

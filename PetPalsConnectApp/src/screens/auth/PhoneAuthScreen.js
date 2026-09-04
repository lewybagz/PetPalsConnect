import React, { useState } from "react";
import { View, Button, TextInput } from "react-native";
import { getAuth, PhoneAuthProvider } from "@react-native-firebase/auth";
import { useToast } from "../../components/ui";

/**
 * Signing in with a phone number.
 *
 * This took `(navigation)` as its whole props object, so `navigation.navigate`
 * was `props.navigate` - undefined - and the "You will be redirected to the
 * login screen" alert would have thrown on OK. It does not need the prop at
 * all: signing in changes Firebase auth state and `RootNavigator` swaps the
 * whole tree, so navigating by hand targets a route that no longer exists.
 */
const PhoneAuth = () => {
  const toast = useToast();
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
      toast.success("Code sent to your phone.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmCode = async () => {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await auth.signInWithCredential(credential);
      toast.success("Signed in.");
    } catch (err) {
      toast.error(err.message);
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

// LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Button,
  Alert,
  TouchableOpacity,
  styles,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getAuth, getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import AnimatedButton from "../../components/AnimatedButton";
import { useTailwind } from "nativewind";
import { useDispatch } from "react-redux";
import { setUserId, setUser } from "../../redux/actions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useSelector } from "react-redux";
import * as SecureStore from "expo-secure-store";

function LoginScreen({ navigation }) {
  const [showTwoFAModal, setShowTwoFAModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const tailwind = useTailwind();
  const db = getFirestore();
  const userId = useSelector((state) => state.user.userId);
  const dispatch = useDispatch();

  const onLoginPress = () => {
    const auth = getAuth();
    signInWithEmailAndPassword(auth, email, password)
      .then(async (response) => {
        console.log("Logged in with:", response.user);

        // Securely store the token
        response.user.getIdToken().then((token) => {
          SecureStore.setItemAsync("userToken", token); // Store the token
        });

        const userDocRef = doc(db, "users", response.user.email);
        const docSnapshot = await getDoc(userDocRef);
        dispatch(setUserId(response.user.uid));
        dispatch(setUser(docSnapshot.data()));

        if (!docSnapshot.exists()) {
          await setDoc(userDocRef, {
            email: response.user.email,
            createdAt: new Date(),
            // Add any additional initialization fields here
          });
          cacheUserData({
            email: response.user.email,
            // include other user details as needed
          });
          navigation.navigate("AddPet", { isNewUser: true });
        } else {
          const userData = docSnapshot.data();
          cacheUserData(userData);
          navigation.navigate("Home");

          // Check if 2FA is not enabled and show the modal
          if (!userData.twoFactorAuthenticationEnabled) {
            setShowTwoFAModal(true);
          }
        }
      })
      .catch((error) => {
        setErrorMessage(error.message); // Display error message to the user
      });
  };

  const TwoFAModal = ({ visible, onClose, onEnable }) => {
    const [method, setMethod] = useState("phone"); // Default to phone

    return (
      <Modal visible={visible} animationType="slide" transparent={true}>
        <View style={styles.modalView}>
          <Text style={styles.modalText}>Enable Two-Factor Authentication</Text>

          <TouchableOpacity
            onPress={() => setMethod("phone")}
            style={[styles.optionButton, method === "phone" && styles.selected]}
          >
            <Text>Use Phone Number</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMethod("email")}
            style={[styles.optionButton, method === "email" && styles.selected]}
          >
            <Text>Use Email</Text>
          </TouchableOpacity>

          <Button title="Enable" onPress={() => onEnable(method)} />
          <Button title="Later" onPress={onClose} />
        </View>
      </Modal>
    );
  };

  const cacheUserData = async (userData) => {
    try {
      const jsonValue = JSON.stringify(userData);
      await AsyncStorage.setItem("@userData", jsonValue);
    } catch (e) {
      console.error("Error caching user data:", e);
    }
  };

  const handleEnableTwoFA = async (method) => {
    try {
      const enable2FA = method === "phone" || method === "email"; // Assuming 'phone' or 'email' method enables 2FA

      await axios.post("/api/user/settings/2fa", {
        userId: userId, // Replace with actual logged-in user's ID
        enable2FA: enable2FA,
      });

      Alert.alert(
        "Success",
        `Two-Factor Authentication has been ${
          enable2FA ? "enabled" : "disabled"
        }.`
      );
    } catch (error) {
      console.error("Error updating 2FA setting:", error);
      Alert.alert(
        "Error",
        "Failed to update Two-Factor Authentication setting"
      );
    }

    setShowTwoFAModal(false);
  };

  return (
    <View style={tailwind("flex-1 justify-center items-center bg-gray-100")}>
      <View style={tailwind("w-full px-10")}>
        <Text
          style={tailwind("text-2xl font-bold mb-2 text-center text-gray-800")}
        >
          Login
        </Text>
        {errorMessage ? (
          <Text style={tailwind("text-center text-red-500")}>
            {errorMessage}
          </Text>
        ) : null}
        <View style={tailwind("mb-4")}>
          <TextInput
            style={tailwind("border border-gray-300 p-2 rounded")}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="sentences"
            textContentType="emailAddress" // iOS only
            placeholderTextColor="gray"
          />
        </View>
        <View style={tailwind("mb-6")}>
          <TextInput
            style={tailwind("border border-gray-300 p-2 rounded")}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="sentences"
            textContentType="password" // iOS only
            placeholderTextColor="gray"
          />
        </View>
        <AnimatedButton
          text="Login"
          onPress={onLoginPress}
          buttonStyle={tailwind("mt-4")}
        />
      </View>
      <TwoFAModal
        visible={showTwoFAModal}
        onClose={() => setShowTwoFAModal(false)}
        onEnable={handleEnableTwoFA}
      />
    </View>
  );
}

export default LoginScreen;

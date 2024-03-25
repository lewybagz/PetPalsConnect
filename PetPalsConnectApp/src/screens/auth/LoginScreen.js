// LoginScreen.js
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import AnimatedButton from "../../components/AnimatedButton";
import { useTailwind } from "nativewind";
import { useDispatch } from "react-redux";
import { setUserId, setUser } from "../../redux/actions";
import AsyncStorage from "@react-native-async-storage/async-storage";

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const tailwind = useTailwind();
  const db = getFirestore();
  const auth = getAuth();
  const dispatch = useDispatch();

  const onLoginPress = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then(async (response) => {
        console.log("Logged in with:", response.user);

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
          navigation.navigate("AddPetScreen", { isNewUser: true });
        } else {
          const userData = docSnapshot.data();
          cacheUserData(userData);
          navigation.navigate("Home");
        }
      })
      .catch((error) => {
        setErrorMessage(error.message); // Display error message to the user
      });
  };

  const cacheUserData = async (userData) => {
    try {
      const jsonValue = JSON.stringify(userData);
      await AsyncStorage.setItem("@userData", jsonValue);
    } catch (e) {
      console.error("Error caching user data:", e);
    }
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
    </View>
  );
}

export default LoginScreen;

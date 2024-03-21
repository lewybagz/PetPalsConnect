// LoginScreen.js
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import AnimatedButton from "../../components/AnimatedButton";
import { useTailwind } from "nativewind";

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const tailwind = useTailwind();
  const db = getFirestore();

  const auth = getAuth();

  const onLoginPress = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then(async (response) => {
        console.log("Logged in with:", response.user);
        // Check if first time login
        const isNewUser = !(await checkIfUserExists(response.user.email));
        if (isNewUser) {
          createUserProfile(response.user);
          navigation.navigate("AddPetScreen", { isNewUser: true });
        } else {
          navigation.navigate("Home");
        }
      })
      .catch((error) => {
        setErrorMessage(error.message);
        // Display error message to the user
      });
  };

  async function createUserProfile(user) {
    // Function to create a user profile in Firestore if it doesn't exist
    const userDoc = doc(db, "users", user.email);
    const docSnapshot = await getDoc(userDoc);

    if (!docSnapshot.exists()) {
      // Firestore document reference
      await setDoc(userDoc, {
        // Add initial user profile data here
        email: user.email,
        createdAt: new Date(),
        // Any additional fields you want to initialize
      });
    }
  }

  async function checkIfUserExists(email) {
    // Assuming you have a 'users' collection in Firestore
    // where the document ID is the user's email.
    const userDoc = doc(db, "users", email);
    const docSnapshot = await getDoc(userDoc);

    // If the document exists, it's not a new user.
    return docSnapshot.exists();
  }

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

import React, { useEffect } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import { useTailwind } from "nativewind";
import { useSelector, useDispatch } from "react-redux";
import LoadingScreen from "../../components/LoadingScreenComponent";

const AccountInformationScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.userReducer.user);
  const isLoading = useSelector((state) => state.userReducer.isLoading); // Access isLoading
  const error = useSelector((state) => state.userReducer.error); // Access error
  const tailwind = useTailwind();
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const getUserProfile = async () => {
      const authUser = auth.currentUser;
      if (authUser) {
        const userDocRef = doc(db, "users", authUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const fetchedUserInfo = userDocSnap.data();
            dispatch({ type: "SET_USER", payload: fetchedUserInfo });
          } else {
            Alert.alert("Profile Error", "No such document!");
          }
        } catch (error) {
          Alert.alert("Error", "An error occurred while fetching user data.");
        }
      } else {
        Alert.alert("User Error", "No user logged in!");
      }
    };
    getUserProfile();
  }, [auth, db, dispatch]);

  const handleUpdate = async () => {
    try {
      const authUser = auth.currentUser;
      if (authUser) {
        const userDocRef = doc(db, "users", authUser.uid);
        await updateDoc(userDocRef, {
          email: user.email,
          phone: user.phone,
        });
        Alert.alert(
          "Info Updated",
          "Your account information has been updated."
        );
      } else {
        Alert.alert("Update Failed", "No user logged in.");
      }
    } catch (error) {
      console.error("Error updating user information:", error);
      Alert.alert(
        "Update Failed",
        "Unable to update account information. Please try again."
      );
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    Alert.alert("Error", error);
  }

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>
        Account Information
      </Text>
      <Text style={tailwind("text-lg mb-4")}>
        {user?.displayName || "User"}
      </Text>

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={user?.email || ""}
        onChangeText={(text) =>
          dispatch({ type: "SET_USER", payload: { ...user, email: text } })
        }
        placeholder="Email"
        keyboardType="email-address"
      />

      <TextInput
        style={tailwind("border border-gray-300 p-2 rounded mb-4")}
        value={user?.phone || ""}
        onChangeText={(text) =>
          dispatch({ type: "SET_USER", payload: { ...user, phone: text } })
        }
        placeholder="Phone Number"
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        onPress={handleUpdate}
        style={tailwind("bg-blue-500 py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-white text-center")}>
          Update Information
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AccountInformationScreen;

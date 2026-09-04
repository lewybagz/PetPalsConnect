import React, { useEffect } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import { useTailwind } from "../../styles/tailwind";
import { useSelector, useDispatch } from "react-redux";
import LoadingScreen from "../../components/LoadingScreenComponent";
import { useToast } from "../../components/ui";

const AccountInformationScreen = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const isLoading = useSelector((state) => state.user.isLoading); // Access isLoading
  const error = useSelector((state) => state.user.error); // Access error
  const tailwind = useTailwind();
  const toast = useToast();
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
            toast.error("We couldn't find your profile.");
          }
        } catch (error) {
          console.warn("[accountinformation]", error.message);
          toast.error("Couldn't load your account.");
        }
      } else {
        toast.error("You need to be signed in.");
      }
    };
    getUserProfile();
  }, [auth, db, dispatch, toast]);

  const handleUpdate = async () => {
    try {
      const authUser = auth.currentUser;
      if (authUser) {
        const userDocRef = doc(db, "users", authUser.uid);
        await updateDoc(userDocRef, {
          email: user.email,
          phone: user.phone,
        });
        toast.success("Saved");
      } else {
        toast.error("You need to be signed in.");
      }
    } catch (error) {
      console.error("Error updating user information:", error);
      toast.error("Couldn't save that. Try again.");
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    toast.error(error);
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
        style={tailwind("border border-border p-2 rounded mb-4")}
        value={user?.email || ""}
        onChangeText={(text) =>
          dispatch({ type: "SET_USER", payload: { ...user, email: text } })
        }
        placeholder="Email"
        keyboardType="email-address"
      />

      <TextInput
        style={tailwind("border border-border p-2 rounded mb-4")}
        value={user?.phone || ""}
        onChangeText={(text) =>
          dispatch({ type: "SET_USER", payload: { ...user, phone: text } })
        }
        placeholder="Phone Number"
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        onPress={handleUpdate}
        style={tailwind("bg-primary py-2 px-4 rounded")}
      >
        <Text style={tailwind("text-onPrimary text-center")}>
          Update Information
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AccountInformationScreen;

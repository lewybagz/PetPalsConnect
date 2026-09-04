import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Picker,
  Button,
  TextInput,
} from "react-native";
import { useTailwind } from "../../styles/tailwind";
import { auth } from "../../../firebase/firebaseConfig";
import api from "../../api/axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { setError } from "../../redux/actions";
import { Toggle, useToast } from "../../components/ui";

const SecuritySettingsScreen = () => {
  const [twoFactorAuthEnabled, setTwoFactorAuthEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("favoritePet");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const userId = auth.currentUser.uid;
  const tailwind = useTailwind();
  const toast = useToast();
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTwoFactorAuthChange = async (isEnabled, token) => {
    try {
      getToken();
      await api.post(
        "/api/users/settings/2fa",
        {
          userId: userId,
          enable2FA: isEnabled,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setTwoFactorAuthEnabled(isEnabled);
      toast.success(
        isEnabled
          ? "Two-factor authentication on"
          : "Two-factor authentication off"
      );
    } catch (error) {
      console.error("Error updating 2FA setting:", error);
      toast.error("Couldn't change two-factor authentication.");
    }
  };

  const toggleTwoFactorAuth = () => {
    const newTwoFactorState = !twoFactorAuthEnabled;
    handleTwoFactorAuthChange(newTwoFactorState);
  };

  const handlePasswordChange = async (token) => {
    if (newPassword !== confirmNewPassword) {
      toast.show("Those two passwords don't match.");
      return;
    }
    try {
      getToken();
      await api.post(
        "/api/users/settings/change-password",
        {
          userId: userId,
          currentPassword,
          newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Password changed");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Couldn't change your password.");
    }
  };

  const handleSecurityQuestionChange = async (token) => {
    try {
      getToken();
      await api.post(
        "/api/users/settings/security-question",
        {
          userId: userId,
          question: selectedQuestion,
          answer: securityAnswer,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Security question saved");
    } catch (error) {
      console.error("Error updating security question:", error);
      toast.error("Couldn't save your security question.");
    }
  };

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-4")}>Security Settings</Text>

      <View style={tailwind("flex-row justify-between py-2")}>
        <Text>Two-Factor Authentication</Text>
        <Toggle
          onValueChange={toggleTwoFactorAuth}
          value={twoFactorAuthEnabled}
        />
        <Text style={tailwind("text-xl font-bold mb-4")}>Change Password</Text>
        <TextInput
          style={tailwind("border p-2 mb-2")}
          placeholder="Current Password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <TextInput
          style={tailwind("border p-2 mb-2")}
          placeholder="New Password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={tailwind("border p-2 mb-4")}
          placeholder="Confirm New Password"
          secureTextEntry
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />
        <Button title="Change Password" onPress={handlePasswordChange} />

        {/* Security Questions Section */}
        <Text style={tailwind("text-xl font-bold mb-4")}>
          Security Questions
        </Text>
        <Picker
          selectedValue={selectedQuestion}
          onValueChange={(itemValue) => setSelectedQuestion(itemValue)}
        >
          <Picker.Item
            label="What was the name of your first pet?"
            value="firstPet"
          />
          <Picker.Item
            label="What was the make of your first car?"
            value="firstCar"
          />
          <Picker.Item
            label="What is your mother&rsqo;s maiden name?"
            value="maidenName"
          />
          <Picker.Item label="In what city were you born?" value="birthCity" />
          <Picker.Item
            label="What is your favorite movie?"
            value="favoriteMovie"
          />
          <Picker.Item
            label="What was the name of your elementary school?"
            value="elementarySchool"
          />
          <Picker.Item
            label="What street did you grow up on?"
            value="childhoodStreet"
          />
          <Picker.Item
            label="What is the name of your favorite childhood friend?"
            value="childhoodFriend"
          />
          <Picker.Item
            label="What was your dream job as a child?"
            value="childhoodDreamJob"
          />
          <Picker.Item
            label="In what city did your parents meet?"
            value="parentsMeetCity"
          />
          <Picker.Item
            label="What was your childhood nickname?"
            value="childhoodNickname"
          />
          {/* Add more questions as needed */}
        </Picker>
        <TextInput
          style={tailwind("border p-2 mb-4")}
          placeholder="Your Answer"
          value={securityAnswer}
          onChangeText={setSecurityAnswer}
        />
        <Button
          title="Update Security Question"
          onPress={handleSecurityQuestionChange}
        />
      </View>
    </ScrollView>
  );
};

export default SecuritySettingsScreen;

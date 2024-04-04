import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { useDispatch } from "react-redux";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";

const GroupChatCreationScreen = ({ route, navigation }) => {
  const { selectedPets } = route.params;
  const [setChatId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [initialMessage, setInitialMessage] = useState("");

  const createGroupChat = async () => {
    const dispatch = useDispatch();

    if (!groupName.trim()) {
      Alert.alert(
        "Group Name Required",
        "Please enter a name for the group chat."
      );
      return;
    }

    try {
      const token = await getStoredToken(); // Retrieve the token
      const groupChatData = {
        GroupName: groupName,
        Participants: selectedPets.map((pet) => pet.owner), // userIds of participants
        Creator: auth.currentUser.uid,
      };

      const response = await axios.post(
        "/api/groupchats/findOrCreate",
        groupChatData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 201 || response.status === 200) {
        const groupChatId = response.data._id;
        dispatch(setChatId(groupChatId));
        navigation.navigate("GroupChatScreen", { chatId: groupChatId });
      } else {
        throw new Error("Failed to find or create group chat");
      }
    } catch (error) {
      console.error("Error with group chat:", error);
      Alert.alert("Error", "Failed to process group chat. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Creating Group Chat</Text>

      <Text style={styles.label}>Selected Pets:</Text>
      <FlatList
        data={selectedPets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={styles.petName}>{item.name}</Text>
        )}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter Group Chat Name"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TextInput
        style={[styles.input, styles.messageInput]}
        placeholder="Initial Message (optional)"
        value={initialMessage}
        onChangeText={setInitialMessage}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={createGroupChat}>
        <Text style={styles.buttonText}>Create Group Chat</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  label: {
    fontWeight: "bold",
    marginTop: 10,
  },
  petName: {
    fontSize: 16,
    marginVertical: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
  },
  messageInput: {
    height: 100,
    textAlignVertical: "top", // Aligns text to the top in multiline input
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default GroupChatCreationScreen;

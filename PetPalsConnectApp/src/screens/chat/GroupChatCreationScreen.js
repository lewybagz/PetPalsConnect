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
import axios from "axios";

const GroupChatCreationScreen = ({ route, navigation }) => {
  const { selectedPets } = route.params;
  const [groupName, setGroupName] = useState("");
  const [initialMessage, setInitialMessage] = useState("");

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      Alert.alert(
        "Group Name Required",
        "Please enter a name for the group chat."
      );
      return;
    }

    try {
      const groupChatData = {
        GroupName: groupName,
        Participants: selectedPets.map((pet) => pet.owner), // Assuming each pet has an 'owner' field with the user ID
        Creator: auth.currentUser.uid, // Assuming you have the current user's ID
      };

      const response = await axios.post(
        "/api/groupchats/findOrCreate",
        groupChatData
      );

      if (response.status === 201 || response.status === 200) {
        Alert.alert(
          "Success",
          response.status === 201
            ? "Group chat created successfully"
            : "Group chat found"
        );
        navigation.navigate("GroupChatScreen", { chatId: response.data._id });
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

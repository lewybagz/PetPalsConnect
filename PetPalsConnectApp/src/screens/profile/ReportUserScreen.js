import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import axios from "axios";

const ReportUserScreen = ({ route }) => {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Pending"); // Default status for new reports
  const reportedUser = route.params.userId; // The ID of the user being reported
  const reporter = "CURRENT_USER_ID"; // Replace with current user's ID

  const submitReport = async () => {
    try {
      const response = await axios.post("/api/reports", {
        Content: content,
        ReportedUser: reportedUser,
        Reporter: reporter,
        Status: status, // Using the current status (default "Pending")
      });

      if (response.status === 201) {
        setStatus("Submitted"); // Update the status to "Submitted"
        Alert.alert(
          "Report Submitted",
          "Your report has been submitted successfully.",
          [
            { text: "OK", onPress: () => console.log("OK Pressed") },
            { text: "Block User", onPress: blockUser },
          ]
        );
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      setStatus("Failed"); // Update the status to "Failed"
      Alert.alert("Error", "There was an error submitting the report.");
    }
  };

  const blockUser = async () => {
    // Implement the logic to block the user
    // This could involve sending a request to your API to update the blocklist
    try {
      const blockResponse = await axios.post("/api/blocklist", {
        BlockedUser: reportedUser,
        Owner: reporter, // Assuming the 'Owner' field refers to the user who is blocking
      });

      if (blockResponse.status === 201) {
        Alert.alert("User Blocked", "The user has been blocked successfully.");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      Alert.alert("Error", "There was an error blocking the user.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report User</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the issue..."
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={4}
      />
      <TouchableOpacity style={styles.button} onPress={submitReport}>
        <Text style={styles.buttonText}>Submit Report</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    textAlignVertical: "top", // To align text to the top in multiline TextInput
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
});

export default ReportUserScreen;

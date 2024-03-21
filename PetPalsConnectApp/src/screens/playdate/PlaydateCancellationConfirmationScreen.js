// PlaydateCancellationConfirmationScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, Alert, TouchableOpacity } from "react-native";
import axios from "axios";
import { useTailwind } from "nativewind";

const PlaydateCancellationConfirmationScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const { playdateId } = route.params; // Get playdateId from navigation params
  const tailwind = useTailwind();

  const handleCancellation = async () => {
    try {
      await axios.post(`/api/playdates/cancel/${playdateId}`, { message });
      Alert.alert(
        "Playdate Cancelled",
        "Your playdate has been successfully cancelled."
      );
      navigation.goBack(); // or navigate to a confirmation screen
    } catch (error) {
      Alert.alert("Error", "There was an error cancelling the playdate.");
    }
  };

  return (
    <View style={tailwind("flex-1 bg-gray-100 p-4")}>
      <Text
        style={tailwind("text-3xl font-bold text-center text-gray-800 mb-6")}
      >
        Cancel Playdate
      </Text>
      <Text style={tailwind("text-lg text-gray-600 mb-4")}>
        Would you like to send a message with your cancellation?
      </Text>
      <TextInput
        style={tailwind("border border-gray-300 p-4 rounded-md bg-white mb-6")}
        placeholder="Enter your message here"
        placeholderTextColor="gray"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
      />
      <TouchableOpacity
        style={tailwind("bg-red-500 py-3 rounded-md items-center")}
        onPress={handleCancellation}
      >
        <Text style={tailwind("text-white text-lg font-semibold")}>
          Confirm Cancellation
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default PlaydateCancellationConfirmationScreen;

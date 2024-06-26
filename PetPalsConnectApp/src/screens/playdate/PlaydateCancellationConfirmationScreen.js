// PlaydateCancellationConfirmationScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, Alert, TouchableOpacity } from "react-native";
import axios from "axios";
import { useTailwind } from "nativewind";
import { getStoredToken } from "../../../utils/tokenutil";

const PlaydateCancellationConfirmationScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const { playdateId } = route.params;
  const tailwind = useTailwind();

  const handleCancellation = async () => {
    try {
      const token = await getStoredToken();
      await axios.post(
        `/api/playdates/cancel/${playdateId}`,
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(
        "Playdate Cancelled",
        "Your playdate has been successfully cancelled."
      );
      navigation.navigate("ScheduledPlaydates");
    } catch (error) {
      console.error("Error cancelling playdate:", error);
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
        Send a message with your cancellation?{" "}
        <Text style={tailwind("text-sm text-gray-400")}>(optional)</Text>
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

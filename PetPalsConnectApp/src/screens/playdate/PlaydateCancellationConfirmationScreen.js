// PlaydateCancellationConfirmationScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import api from "../../api/axios";
import { useTailwind } from "../../styles/tailwind";
import { getStoredToken } from "../../../utils/tokenutil";
import { useToast } from "../../components/ui";

const PlaydateCancellationConfirmationScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState("");
  const { playdateId } = route.params;
  const tailwind = useTailwind();
  const toast = useToast();

  const handleCancellation = async () => {
    try {
      const token = await getStoredToken();
      await api.patch(
        `/api/playdates/${playdateId}/cancel`,
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Playdate cancelled - everyone invited has been told.");
      navigation.navigate("Playdates");
    } catch (error) {
      console.error("Error cancelling playdate:", error);
      toast.error("Couldn't cancel that playdate.");
    }
  };

  return (
    <View style={tailwind("flex-1 bg-surfaceAlt p-4")}>
      <Text
        style={tailwind("text-3xl font-bold text-center text-text mb-6")}
      >
        Cancel Playdate
      </Text>
      <Text style={tailwind("text-lg text-textMuted mb-4")}>
        Send a message with your cancellation?{" "}
        <Text style={tailwind("text-sm text-textFaint")}>(optional)</Text>
      </Text>

      <TextInput
        style={tailwind("border border-border p-4 rounded-md bg-surface mb-6")}
        placeholder="Enter your message here"
        placeholderTextColor="gray"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
      />
      <TouchableOpacity
        style={tailwind("bg-danger py-3 rounded-md items-center")}
        onPress={handleCancellation}
      >
        <Text style={tailwind("text-onPrimary text-lg font-semibold")}>
          Confirm Cancellation
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default PlaydateCancellationConfirmationScreen;

import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import axios from "axios";
import DateTimePickerComponent from "../components/DateTimePickerComponent";
import {
  sendPushNotification,
  createNotificationInDB,
} from "../../../services/NotificationService";
import { getPetOwner } from "../../../services/PetService";
import { useSelector } from "react-redux";
import { getStoredToken } from "../../../utils/tokenutil";

const SchedulePlaydateDetailsScreen = ({ route, navigation }) => {
  const { petId, locationId } = route.params;
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState("");

  const handleSubmit = async (selectedPet, pet) => {
    const userId = useSelector((state) => state.user.userId);
    // Prepare playdate data
    const playdateData = {
      Date: date,
      Location: locationId,
      Notes: notes,
      Participants: [userId],
      PetsInvolved: [petId],
      Creator: userId,
    };

    try {
      const token = await getStoredToken();
      const response = await axios.post("/api/playdates", playdateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        const ownerId = await getPetOwner(pet._id);

        sendPushNotification({
          recipientUserId: ownerId,
          title: "Playdate Request",
          message: `${selectedPet.name} has requested a playdate with ${pet.name}`,
          data: { playdateId: response.data._id },
        });
        createNotificationInDB({
          content: "A playdate has been requested",
          recipientId: ownerId,
          type: "Playdate Request",
          creatorId: userId,
        });
      }
      navigation.navigate("PlaydateCreatedScreen", { playdate: response.data });
    } catch (error) {
      console.error("Error creating playdate:", error);
      Alert.alert(
        "Playdate Creation Failed",
        "Unable to create playdate. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule a Playdate</Text>
      <DateTimePickerComponent date={date} onDateChange={setDate} mode="date" />
      <DateTimePickerComponent date={date} onDateChange={setDate} mode="time" />
      <TextInput
        style={styles.input}
        placeholder="Notes for the playdate"
        multiline
        numberOfLines={4}
        onChangeText={setNotes}
        value={notes}
      />
      <Button title="Submit Playdate" onPress={handleSubmit} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderColor: "gray",
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default SchedulePlaydateDetailsScreen;

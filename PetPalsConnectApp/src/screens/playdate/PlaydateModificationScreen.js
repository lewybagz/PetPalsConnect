import React, { useState, useEffect } from "react";
import { View, Text, Button, Alert } from "react-native";
import axios from "axios";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import {
  sendPushNotification,
  createNotificationInDB,
} from "../../../services/NotificationService";
import { getStoredToken } from "../../../utils/tokenutil";

const PlaydateModificationScreen = ({ route, navigation }) => {
  const { playdateId } = route.params;
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (route.params?.selectedLocation) {
        setLocation(route.params.selectedLocation);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedLocation]);

  const updatePlaydate = async () => {
    try {
      const token = await getStoredToken();
      await axios.patch(
        `/api/playdates/update/${playdateId}`,
        {
          date,
          time,
          location,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert("Success", "Playdate updated successfully.");
      sendNotificationToParticipant(playdateId, "Playdate details updated");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update playdate details.");
    }
  };

  const sendNotificationToParticipant = async (
    playdateId,
    message,
    recipientId,
    type,
    creatorId
  ) => {
    try {
      await sendPushNotification({
        recipientUserId: recipientId,
        title: `Playdate Update (${type})`,
        message: message,
        data: { playdateId },
      });

      console.log("Notification sent to participant.");

      await createNotificationInDB({
        content: message,
        recipientId,
        type,
        creatorId,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  return (
    <View>
      <Text>Update Playdate Details</Text>
      <DateTimePickerComponent date={date} mode="date" onDateChange={setDate} />
      <DateTimePickerComponent date={time} mode="time" onDateChange={setTime} />
      <Button
        title="Choose Location"
        onPress={() => navigation.navigate("PotentialPlaydateLocationsScreen")}
      />
      <Button title="Update Playdate" onPress={updatePlaydate} />
      {location && <Text>Selected Location: {location.name}</Text>}
    </View>
  );
};

export default PlaydateModificationScreen;

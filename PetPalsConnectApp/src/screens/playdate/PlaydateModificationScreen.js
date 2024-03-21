import React, { useState, useEffect } from "react";
import { View, Text, Button, Alert } from "react-native";
import axios from "axios";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";

const PlaydateModificationScreen = ({ route, navigation }) => {
  const { playdateId } = route.params;
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [location, setLocation] = useState(null);

  useEffect(() => {
    // Listen for changes in the navigation and update the location state
    const unsubscribe = navigation.addListener("focus", () => {
      if (route.params?.selectedLocation) {
        setLocation(route.params.selectedLocation);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedLocation]);

  const updatePlaydate = async () => {
    try {
      await axios.patch(`/api/playdates/update/${playdateId}`, {
        date,
        time,
        location,
      });
      Alert.alert("Success", "Playdate updated successfully.");
      sendNotificationToParticipant(playdateId, "Playdate details updated");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update playdate details.");
    }
  };

  const createNotificationInDB = async (
    content,
    recipientId,
    type,
    creatorId
  ) => {
    try {
      const response = await axios.post(`/api/notifications/create`, {
        Content: content,
        Recipient: recipientId,
        Type: type,
        Creator: creatorId,
      });
      console.log("Notification created in database:", response.data);
    } catch (error) {
      console.error("Error creating notification in database:", error);
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
      await axios.post(`/api/notifications/send`, {
        playdateId,
        message,
      });
      console.log("Notification sent to participant.");
      // Create a notification in the database
      await createNotificationInDB(message, recipientId, type, creatorId);
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

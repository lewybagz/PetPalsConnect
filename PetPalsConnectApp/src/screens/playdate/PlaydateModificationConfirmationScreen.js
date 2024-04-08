import React from "react";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { useSelector, useDispatch } from "react-redux";
import { addNotification } from "../../redux/actions";
import {
  sendPushNotification,
  createNotificationInDB,
} from "../../../services/NotificationService";

import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";

const PlaydateModificationConfirmationScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.userReducer.userId);
  const { playdateId, date, time, location } = route.params;

  const confirmModifications = async () => {
    try {
      const token = await getStoredToken();

      const playdateResponse = await axios.get(`/api/playdates/${playdateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const participants = playdateResponse.data.participants;

      const otherParticipants = participants.filter(
        (participantId) => participantId !== userId
      );

      otherParticipants.forEach(async (participantId) => {
        const notificationDetails = {
          content: "Playdate details have been updated.",
          recipientId: participantId,
          type: "PlaydateUpdate",
          creatorId: userId,
        };

        await sendPushNotification({
          recipientUserId: participantId,
          title: "Playdate Updated",
          message: `Playdate on ${date} has been updated. Check the new details!`,
          data: { playdateId },
        });

        await createNotificationInDB(notificationDetails);

        // Dispatch the new notification to Redux
        dispatch(addNotification(notificationDetails));
      });

      Alert.alert("Success", "Playdate updated successfully.");
      navigation.popToTop();
    } catch (error) {
      Alert.alert("Error", "Failed to confirm modifications.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Playdate Changes</Text>

      <View style={styles.detailContainer}>
        <Text style={styles.label}>New Date:</Text>
        <Text style={styles.detail}>{date.toLocaleDateString()}</Text>
      </View>

      <View style={styles.detailContainer}>
        <Text style={styles.label}>New Time:</Text>
        <Text style={styles.detail}>{time.toLocaleTimeString()}</Text>
      </View>

      {location && (
        <View style={styles.detailContainer}>
          <Text style={styles.label}>New Location:</Text>
          <Text style={styles.detail}>{location.name}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={confirmModifications}>
        <Text style={styles.buttonText}>Confirm Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  detailContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 10,
  },
  label: {
    fontWeight: "bold",
    fontSize: 18,
  },
  detail: {
    fontSize: 18,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PlaydateModificationConfirmationScreen;

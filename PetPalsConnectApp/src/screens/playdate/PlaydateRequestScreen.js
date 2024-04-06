import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { getStoredToken } from "../../../utils/tokenutil";
import { addNotification } from "../../redux/actions";
import {
  sendPushNotification,
  createNotificationInDB,
} from "../../../services/NotificationService";
import { fetchPlaydateDetails } from "../../redux/actions";

const PlaydateRequestScreen = ({ route, navigation }) => {
  const { playdateId } = route.params;
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.userId);
  const { playdateDetails, loading, error } = useSelector(
    (state) => state.playdateReducer
  );
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    dispatch(fetchPlaydateDetails(playdateId));
  }, [dispatch, playdateId]);

  const sendNotificationToSender = async (
    playdateId,
    message,
    recipientId,
    type,
    creatorId
  ) => {
    try {
      const token = await getStoredToken(); // Retrieve the token if needed for axios call
      const playdateResponse = await axios.get(`/api/playdates/${playdateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const senderId = playdateResponse.data.senderId;

      // Notify the sender of the playdate
      await sendPushNotification({
        recipientUserId: senderId,
        title: "Playdate Update",
        message: message,
        data: { playdateId },
      });

      // Create a notification in the database for the sender
      await createNotificationInDB({
        content: message,
        recipientId: senderId,
        type,
        creatorId,
      });

      // If there are other participants, notify them as well
      const participants = playdateResponse.data.participants.filter(
        (pid) => pid !== creatorId
      );
      for (const participantId of participants) {
        await sendPushNotification({
          recipientUserId: participantId,
          title: "Playdate Update",
          message: `Participant update for playdate on ${playdateResponse.data.date}`,
          data: { playdateId },
        });

        await createNotificationInDB({
          content: `Participant update for playdate on ${playdateResponse.data.date}`,
          recipientId: participantId,
          type: "PlaydateParticipantUpdate",
          creatorId,
        });
      }
      // For sender
      dispatch(
        addNotification({
          content: message,
          recipientId: senderId,
          type,
          creatorId,
        })
      );

      participants.forEach((participantId) => {
        dispatch(
          addNotification({
            content: `Participant update for playdate on ${playdateResponse.data.date}`,
            recipientId: participantId,
            type: "PlaydateParticipantUpdate",
            creatorId,
          })
        );
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const token = await getStoredToken(); // Retrieve the token
      await axios.post(
        `/api/playdates/accept/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Assuming 'userId' is the ID of the user who is accepting the request
      await sendNotificationToSender(
        playdateId,
        "Your playdate request has been accepted.",
        null, // replace with recipientId if needed
        "PlaydateAcceptance",
        userId
      );

      Alert.alert("Accepted", "You have accepted the playdate request.");
      navigation.navigate("UpcomingPlaydatesScreen");
    } catch (error) {
      Alert.alert("Error", "Failed to accept the playdate request.");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const token = await getStoredToken();
      await axios.post(
        `/api/playdates/decline/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      await sendNotificationToSender(
        playdateId,
        "Your playdate request has been declined."
      );
      Alert.alert("Declined", "You have declined the playdate request.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to decline the playdate request.");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text>Error loading playdate details.</Text>
      </View>
    );
  }

  if (!playdateDetails) {
    return (
      <View style={styles.centered}>
        <Text>No playdate details available.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={{ uri: playdateDetails.petPhoto }}
        style={styles.petImage}
      />
      <Text style={styles.petName}>{playdateDetails.petName}</Text>
      <Text style={styles.ownerName}>Owner: {playdateDetails.ownerName}</Text>
      <Text style={styles.location}>Location: {playdateDetails.location}</Text>
      <Text style={styles.dateTime}>
        {new Date(playdateDetails.date).toLocaleString()}
      </Text>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
          disabled={accepting}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={handleDecline}
          disabled={declining}
        >
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  petImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },
  petName: {
    fontSize: 24,
    fontWeight: "bold",
  },
  ownerName: {
    fontSize: 18,
    color: "gray",
    marginBottom: 10,
  },
  location: {
    fontSize: 18,
    marginBottom: 5,
  },
  dateTime: {
    fontSize: 18,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  button: {
    padding: 15,
    borderRadius: 10,
    width: "40%",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: "green",
  },
  declineButton: {
    backgroundColor: "red",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
  },
});

export default PlaydateRequestScreen;

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
import { fetchPlaydateDetails } from "../../redux/actions";
import { setError } from "../../redux/actions";

const PlaydateRequestScreen = ({ route, navigation }) => {
  const { playdateId } = route.params;
  const dispatch = useDispatch();
  const getToken = async () => {
    try {
      const token = await getStoredToken();
      return token;
    } catch (err) {
      setError(err.message);
    }
  };
  const { playdateDetails, loading, error } = useSelector(
    (state) => state.playdateReducer
  );
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    dispatch(fetchPlaydateDetails(playdateId));
  }, [dispatch, playdateId]);

  const handleAccept = async (token) => {
    setAccepting(true);
    try {
      await axios.post(
        `/api/playdates/accept/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Accepted", "You have accepted the playdate request.");
      navigation.navigate("UpcomingPlaydates");
    } catch (error) {
      Alert.alert("Error", "Failed to accept the playdate request.");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (token) => {
    setDeclining(true);
    try {
      getToken();
      await axios.post(
        `/api/playdates/decline/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
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

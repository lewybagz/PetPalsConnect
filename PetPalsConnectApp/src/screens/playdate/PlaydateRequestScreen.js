import React, { useState, useEffect, useMemo } from "react";
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
import api from "../../api/axios";
import { useDispatch, useSelector } from "react-redux";
import { getStoredToken } from "../../../utils/tokenutil";
import { fetchPlaydateDetails , setError } from "../../redux/actions";
import { useTokens } from "../../context/AppThemeContext";

const PlaydateRequestScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

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
      await api.post(
        `/api/playdates/accept/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert("Accepted", "You have accepted the playdate request.");
      navigation.navigate("UpcomingPlaydate");
    } catch (error) {
      console.warn("[playdaterequest]", error.message);
      Alert.alert("Error", "Failed to accept the playdate request.");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (token) => {
    setDeclining(true);
    try {
      getToken();
      await api.post(
        `/api/playdates/decline/${playdateId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert("Declined", "You have declined the playdate request.");
      navigation.goBack();
    } catch (error) {
      console.warn("[playdaterequest]", error.message);
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

const makeStyles = (t) => StyleSheet.create({
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
    color: t.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  ownerName: {
    fontSize: 18,
    color: t.textMuted,
    marginBottom: 10,
  },
  location: {
    color: t.text,
    fontSize: 18,
    marginBottom: 5,
  },
  dateTime: {
    color: t.text,
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
    backgroundColor: t.success,
  },
  declineButton: {
    backgroundColor: t.danger,
  },
  buttonText: {
    color: t.surface,
    fontSize: 18,
  },
});

export default PlaydateRequestScreen;

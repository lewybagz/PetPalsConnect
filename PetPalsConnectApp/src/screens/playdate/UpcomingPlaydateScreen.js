import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import Icon from "react-native-vector-icons/FontAwesome";
import { getStoredToken } from "../../../utils/tokenutil";

import ScheduledPlaydateCardComponent from "../../components/ScheduledPlaydateCardComponent";
const UpcomingPlaydateScreen = (navigation) => {
  const [playdates, setPlaydates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUpcomingPlaydates = async () => {
      setLoading(true);
      try {
        const token = await getStoredToken(); // Retrieve the token
        // Replace with your actual API endpoint
        const response = await axios.get("/api/playdates/upcoming", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPlaydates(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingPlaydates();
  }, []);

  const navigateToReview = (playdate) => {
    if (new Date(playdate.startTime) <= new Date()) {
      navigation.navigate("PostPlaydateReview", {
        playdateId: playdate._id,
      });
    } else {
      Alert.alert(
        "Review Not Available",
        "The review will be available after the playdate begins."
      );
    }
  };

  const handleCancel = (playdateId) => {
    navigation.navigate("PlaydateCancellationConfirmation", {
      playdateId,
    });
  };

  const renderPlaydate = ({ item }) => (
    <ScheduledPlaydateCardComponent
      playdate={item}
      onCancel={handleCancel}
      onNavigateToReview={navigateToReview}
    />
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="exclamation-triangle" size={30} color="red" />
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      ) : (
        <FlatList
          data={playdates}
          renderItem={renderPlaydate}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 22,
  },
  itemContainer: {
    backgroundColor: "#f9f9f9",
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 5,
  },
  title: {
    fontSize: 24,
  },
});

export default UpcomingPlaydateScreen;

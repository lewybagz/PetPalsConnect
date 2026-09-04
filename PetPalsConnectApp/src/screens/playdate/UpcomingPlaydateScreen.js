import React, { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, Alert } from "react-native";
import LoadingScreen from "../../components/LoadingScreenComponent";
import api from "../../api/axios";
import { FontAwesome as Icon } from "@expo/vector-icons";
import { getStoredToken } from "../../../utils/tokenutil";

import ScheduledPlaydateCardComponent from "../../components/ScheduledPlaydateCardComponent";
import { useTokens } from "../../context/AppThemeContext";
const UpcomingPlaydateScreen = (navigation) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [playdates, setPlaydates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUpcomingPlaydates = async () => {
      setLoading(true);
      try {
        const token = await getStoredToken(); // Retrieve the token
        // Replace with your actual API endpoint
        const response = await api.get("/api/playdates/upcoming", {
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

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 22,
  },
  itemContainer: {
    backgroundColor: t.surfaceAlt,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 5,
  },
  title: {
    color: t.text,
    fontSize: 24,
  },
});

export default UpcomingPlaydateScreen;

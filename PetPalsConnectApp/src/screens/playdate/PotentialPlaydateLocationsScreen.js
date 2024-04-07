import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import PlayDateLocationCard from "../components/PlayDateLocationCard";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { fetchUserPreferences } from "../../../services/UserService";
import { useSelector } from "react-redux";

const PotentialPlaydateLocationsScreen = (navigation) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);

      try {
        const userId = useSelector((state) => state.user.userId);
        const userPrefs = await fetchUserPreferences(userId);
        const playdateRange = userPrefs.playdateRange;

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              await fetchLocations(latitude, longitude, playdateRange);
            },
            (err) => {
              console.error(err);
              setError(err.message);
            }
          );
        } else {
          setError("Geolocation is not supported by this browser");
        }
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Initialization failed");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const fetchLocations = async (latitude, longitude, playdateRange) => {
    try {
      const token = await getStoredToken();
      const response = await axios.get(`/api/locations`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          range: playdateRange,
          userLat: latitude,
          userLng: longitude,
        },
      });
      setLocations(response.data);
    } catch (err) {
      console.error("Error fetching locations:", err);
      setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      {loading && <LoadingScreen />}
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
      <Text style={styles.header}>Schedule Your Playdate Here</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlayDateLocationCard locationData={item} navigation={navigation} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});

export default PotentialPlaydateLocationsScreen;

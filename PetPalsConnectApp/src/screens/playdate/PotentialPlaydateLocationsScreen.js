import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import PlayDateLocationCard from "../components/PlayDateLocationCard";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";

const PotentialPlaydateLocationsScreen = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const playdateRange = 10; // Fetch this from user settings or AsyncStorage

  useEffect(() => {
    // Function to fetch locations
    const fetchLocations = async (latitude, longitude) => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/locations`, {
          params: {
            range: playdateRange,
            userLat: latitude,
            userLng: longitude,
          },
        });
        setLocations(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Get current position and then fetch locations
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchLocations(latitude, longitude);
        },
        (err) => {
          console.error(err);
          setError(err.message);
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by this browser");
      setLoading(false);
    }
  }, [playdateRange]);

  return (
    <View style={styles.container}>
      {loading && <LoadingScreen />}
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
      <Text style={styles.header}>Schedule Your Playdate Here</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PlayDateLocationCard locationData={item} />}
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

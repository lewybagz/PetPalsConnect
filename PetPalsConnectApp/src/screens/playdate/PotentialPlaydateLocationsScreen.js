import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import PlayDateLocationCard from "../components/PlayDateLocationCard";
import LoadingScreen from "../../components/LoadingScreenComponent";
import axios from "axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { fetchUserPreferences } from "../../../services/UserService";
import { useSelector, useDispatch } from "react-redux";
import {
  clearError,
  endLoading,
  startLoading,
  setError,
} from "../../redux/actions";

const PotentialPlaydateLocationsScreen = (navigation) => {
  const [locations, setLocations] = useState([]);
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.userReducer.userId);
  const isLoading = useSelector((state) => state.playdateReducer.isLoading);
  const error = useSelector((state) => state.playdateReducer.error);

  useEffect(() => {
    const initialize = async () => {
      dispatch(startLoading());
      try {
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
              dispatch(setError(err.message));
            }
          );
        } else {
          dispatch(setError("Geolocation is not supported by this browser"));
        }
      } catch (err) {
        console.error("Error initializing:", err);
        dispatch(setError("Initialization failed"));
      } finally {
        dispatch(endLoading());
      }
    };

    initialize();
  }, [dispatch, userId]);

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
      dispatch(setError(err.message));
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    useEffect(() => {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }, [error, dispatch]);
  }

  return (
    <View style={styles.container}>
      {isLoading && <LoadingScreen />}
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

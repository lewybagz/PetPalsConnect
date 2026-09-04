import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import LoadingScreen from "../../components/LoadingScreenComponent";
import api from "../../api/axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { fetchUserPreferences } from "../../../services/UserService";
import { useSelector, useDispatch } from "react-redux";
import {
  clearError,
  endLoading,
  startLoading,
  setError,
} from "../../redux/actions";
import { useTokens } from "../../context/AppThemeContext";

const PotentialPlaydateLocationsScreen = (navigation) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [locations, setLocations] = useState([]);
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.user.userId);
  const isLoading = useSelector((state) => state.playdate.isLoading);
  const error = useSelector((state) => state.playdate.error);

  const fetchLocations = async (latitude, longitude, playdateRange) => {
    try {
      const token = await getStoredToken();
      const response = await api.get(`/api/locations`, {
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


  // The effect was nested inside `if (error)`, so it only registered on renders
  // where an error existed - changing hook order between renders. The condition
  // belongs inside the effect, and the loading guard after every hook.
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  if (isLoading) {
    return <LoadingScreen />;
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

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    color: t.text,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: t.danger,
    textAlign: "center",
    marginBottom: 10,
  },
});

export default PotentialPlaydateLocationsScreen;

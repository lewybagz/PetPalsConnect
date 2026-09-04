import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import ReviewComponent from "./ReviewComponent";
import { getStoredToken } from "../../utils/tokenutil";
import api from "../api/axios";
import { useTokens } from "../context/AppThemeContext";

const PlayDateLocationCard = ({ locationData, navigation }) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (locationData._id) {
      const fetchReviews = async () => {
        try {
          const token = await getStoredToken();
          const response = await api.get(
            `/api/reviews/location/${locationData._id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          setReviews(response.data);
        } catch (error) {
          console.error("Error fetching reviews:", error);
        }
      };

      fetchReviews();
    }
  }, [locationData]);

  const handleSchedulePlaydate = () => {
    // One scheduling screen, told what is already decided. This used to open
    // `PlaydatePetSelection` -> `SchedulePlaydateDetails`, three screens for
    // the same five fields, which could not create a playdate at all.
    navigation.navigate("SchedulePlaydate", { locationId: locationData._id });
  };
  return (
    <View style={styles.card}>
      {locationData.photo && (
        <Image source={{ uri: locationData.photo }} style={styles.image} />
      )}
      {/* The heading was the street address, so a card for Dolores Park was
          titled "19th St & Dolores St" and the name appeared nowhere. */}
      <Text style={styles.title}>{locationData.name ?? locationData.address}</Text>
      {locationData.name && locationData.address ? (
        <Text style={styles.description}>{locationData.address}</Text>
      ) : null}
      {locationData.description && (
        <Text style={styles.description}>{locationData.description}</Text>
      )}
      <Text style={styles.rating}>Rating: {locationData.rating}</Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReviewComponent reviewData={item} />}
      />
      <TouchableOpacity
        onPress={handleSchedulePlaydate}
        style={styles.scheduleButton}
      >
        <Text style={styles.scheduleButtonText}>Schedule a Playdate Here</Text>
      </TouchableOpacity>{" "}
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    shadowColor: t.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  image: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  title: {
    color: t.text,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: t.textMuted,
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    color: t.success,
    marginTop: 4,
  },
  scheduleButton: {
    marginTop: 10,
    backgroundColor: t.primary,
    padding: 10,
    borderRadius: 5,
  },
  scheduleButtonText: {
    color: t.surface,
    textAlign: "center",
  },
});

export default PlayDateLocationCard;

import React, { useEffect, useState } from "react";
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
import axios from "axios";

const PlayDateLocationCard = ({ locationData, navigation }) => {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (locationData._id) {
      const fetchReviews = async () => {
        try {
          const token = await getStoredToken();
          const response = await axios.get(
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
    navigation.navigate("PetSelectionScreen", { locationId: locationData._id });
  };
  return (
    <View style={styles.card}>
      <Image source={{ uri: locationData.photo }} style={styles.image} />
      <Text style={styles.title}>{locationData.address}</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
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
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: "gray",
    marginTop: 4,
  },
  rating: {
    fontSize: 14,
    color: "green",
    marginTop: 4,
  },
  scheduleButton: {
    marginTop: 10,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
  },
  scheduleButtonText: {
    color: "#fff",
    textAlign: "center",
  },
});

export default PlayDateLocationCard;

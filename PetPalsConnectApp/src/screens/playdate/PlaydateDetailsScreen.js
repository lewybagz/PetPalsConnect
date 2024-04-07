import React, { useState, useEffect } from "react";
import { Text, ScrollView, StyleSheet } from "react-native";
import axios from "axios";
import LoadingScreen from "../../components/LoadingScreenComponent";
import UserPetCard from "../components/UserPetCard";
import ReviewComponent from "../../components/ReviewComponent";
import { getStoredToken } from "../../../utils/tokenutil";

const PlaydateDetailsScreen = ({ route, navigation }) => {
  const [playdateDetails, setPlaydateDetails] = useState(null);

  useEffect(() => {
    const fetchPlaydateDetails = async () => {
      try {
        const token = await getStoredToken();
        const response = await axios.get(
          `/api/playdates/${route.params.playdateId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setPlaydateDetails(response.data);
      } catch (error) {
        console.error("Error fetching playdate details:", error);
      }
    };
    fetchPlaydateDetails();
  }, [route.params.playdateId]);

  if (!playdateDetails) {
    return <LoadingScreen />;
  }

  const navigateToPetDetails = (petId) => {
    navigation.navigate("PetDetails", { petId: petId });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.subtitle}>Participants</Text>
      {playdateDetails.participants.map((user) => (
        <UserPetCard key={user._id} data={user} type="user" />
      ))}
      <Text style={styles.subtitle}>Pets Involved</Text>
      {playdateDetails.petsInvolved.map((pet) => (
        <UserPetCard
          key={pet._id}
          data={pet}
          type="pet"
          onPress={() => navigateToPetDetails(pet._id)}
        />
      ))}
      <Text style={styles.title}>Playdate Details</Text>
      <Text>Date: {new Date(playdateDetails.date).toLocaleDateString()}</Text>
      <Text>Location: {playdateDetails.location.name}</Text>
      <Text>Notes: {playdateDetails.notes}</Text>
      <Text style={styles.subtitle}>Reviews</Text>
      {playdateDetails.reviews.map((review) => (
        <ReviewComponent key={review._id} reviewData={review} />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 15,
  },
});

export default PlaydateDetailsScreen;

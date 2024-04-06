import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import UserPetCardComponent from "../components/UserPetCardComponent";
import PlayDateLocationCard from "./PlaydateLocationCardComponent";
import { useSelector } from "react-redux";

const PlaydateCardComponent = ({ playdate }) => {
  const currentUser = useSelector((state) => state.user.currentUser);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const renderPetCard = ({ item }) => <UserPetCardComponent petData={item} />;

  const displayCreatorName = () => {
    return playdate.creator === currentUser ? "You" : playdate.creator;
  };

  const isUpcoming = new Date(playdate.date) > new Date();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{isUpcoming ? "Upcoming" : "Past"}</Text>
      {/* Additional components for participants, pets involved, etc. */}
      <Text style={styles.sectionTitle}>Pets Involved:</Text>
      <FlatList
        data={playdate.petsInvolved}
        renderItem={renderPetCard}
        keyExtractor={(item) => item._id}
        horizontal={true}
      />
      {playdate.location && (
        <PlayDateLocationCard locationData={playdate.location} />
      )}
      <Text>Notes: {playdate.notes || "N/A"}</Text>
      <Text>Date: {formatDate(playdate.date)}</Text>
      <Text>Creator: {displayCreatorName()}</Text>{" "}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 10,
    borderColor: "#ddd",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
});

export default PlaydateCardComponent;

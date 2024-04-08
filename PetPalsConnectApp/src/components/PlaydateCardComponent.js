import React, { useEffect } from "react";
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";
import UserPetCardComponent from "../components/UserPetCardComponent";
import PlayDateLocationCard from "./PlaydateLocationCardComponent";
import { useSelector, useDispatch } from "react-redux";
import LoadingScreen from "./LoadingScreenComponent";
import { clearError } from "../redux/actions";

const PlaydateCardComponent = ({ playdate, navigation }) => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.userReducer.currentUser);
  const isLoading = useSelector((state) => state.playdate.isLoading);
  const error = useSelector((state) => state.playdate.error);

  // Display a loading indicator when data is loading
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Handle the display and clearing of errors
  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const renderPetCard = ({ item }) => (
    <UserPetCardComponent petData={item} navigation={navigation} />
  );

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
        <PlayDateLocationCard
          locationData={playdate.location}
          navigation={navigation}
        />
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

import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import UserPetCardComponent from "../components/UserPetCardComponent";
import PlayDateLocationCard from "./PlaydateLocationCardComponent";
import { useSelector, useDispatch } from "react-redux";
import LoadingScreen from "./LoadingScreenComponent";
import { clearError } from "../redux/actions";
import { useTokens } from "../context/AppThemeContext";
import { useToast } from "../components/ui";

const PlaydateCardComponent = ({ playdate, navigation }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.user);
  const isLoading = useSelector((state) => state.playdate.isLoading);
  const error = useSelector((state) => state.playdate.error);

  // Display a loading indicator when data is loading

  // Handle the display and clearing of errors
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

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

  // Declared after every hook so hook order stays stable across renders.
  if (isLoading) {
    return <LoadingScreen />;
  }

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

const makeStyles = (t) => StyleSheet.create({
  card: {
    backgroundColor: t.surfaceAlt,
    padding: 15,
    borderRadius: 8,
    shadowColor: t.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 10,
    borderColor: t.border,
    borderWidth: 1,
  },
  sectionTitle: {
    color: t.text,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
  },
  title: {
    color: t.text,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
});

export default PlaydateCardComponent;

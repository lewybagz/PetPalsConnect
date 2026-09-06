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
    <UserPetCardComponent data={item} type="pet" navigation={navigation} />
  );

  /**
   * Who organised it, as a pet.
   *
   * This rendered `playdate.creator` directly when it was not you - a raw
   * ObjectId printed onto the card - and "You" when it was. A playdate is
   * arranged between animals, so the organiser is named by theirs.
   */
  const organiser = () => {
    const creatorId = String(playdate.creator?._id ?? playdate.creator ?? "");
    if (creatorId && creatorId === String(currentUser)) return "you";

    const theirs = (playdate.petsInvolved ?? []).find(
      (pet) => String(pet?.owner?._id ?? pet?.owner ?? "") === creatorId
    );
    return theirs?.name ?? playdate.creator?.username ?? "someone";
  };

  // The pets are the headline. "Upcoming" is a state, not a subject.
  const meeting =
    (playdate.petsInvolved ?? [])
      .map((pet) => pet?.name)
      .filter(Boolean)
      .join(" and ") || "A playdate";

  const isUpcoming = new Date(playdate.date) > new Date();

  // Declared after every hook so hook order stays stable across renders.
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{meeting}</Text>
      <Text style={styles.sectionTitle}>
        {isUpcoming ? "Coming up" : "Already happened"}
      </Text>
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
      <Text>Organised by {organiser()}</Text>
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

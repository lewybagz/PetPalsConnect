// ScheduledPlaydateCardComponent.js
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome as Icon } from "@expo/vector-icons";
import { useTokens } from "../context/AppThemeContext";

const ScheduledPlaydateCardComponent = ({
  playdate,
  onCancel,
  onNavigateToReview,
}) => {
  const tokens = useTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.title}>{playdate.petName}</Text>
      <Text>{new Date(playdate.date).toLocaleString()}</Text>
      <Text>Location: {playdate.locationName}</Text>
      {new Date(playdate.startTime) <= new Date() && (
        <TouchableOpacity
          onPress={() => onNavigateToReview(playdate)}
          style={styles.reviewButton}
        >
          <Text style={styles.reviewButtonText}>Leave a Review</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => onCancel(playdate.id)}
      >
        <Icon name="times-circle" size={24} color="red" />
        <Text style={styles.cancelText}>Cancel Playdate</Text>
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  cardContainer: {
    backgroundColor: t.surfaceAlt,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  reviewButton: {
    backgroundColor: t.success,
    padding: 10,
    marginTop: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  reviewButtonText: {
    color: t.surface,
    fontSize: 16,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  cancelText: {
    color: t.danger,
    marginLeft: 10,
  },
});

export default ScheduledPlaydateCardComponent;
